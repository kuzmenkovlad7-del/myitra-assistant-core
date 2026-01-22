import fs from "fs"
import path from "path"

const root = process.cwd()

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function findComponentFile(componentName) {
  // Try direct common filenames first
  const direct = [
    path.join(root, "components", `${componentName}.tsx`),
    path.join(root, "components", `${componentName}.ts`),
    path.join(root, "components", `${componentName}.jsx`),
    path.join(root, "components", `${componentName}.js`),
  ]
  for (const p of direct) if (fs.existsSync(p)) return p

  // Fallback: search by exported component name
  const all = walk(path.join(root, "components")).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
  const re = new RegExp(`\\b${componentName.replace(/[-/\\]/g, "")}\\b`, "i")
  for (const f of all) {
    const t = fs.readFileSync(f, "utf8")
    if (re.test(t)) {
      // Must contain Dialog usage to be a dialog component candidate
      if (t.includes("<Dialog")) return f
    }
  }
  return null
}

function patchDialogFile(filePath, exportName) {
  let t = fs.readFileSync(filePath, "utf8")
  let changed = false

  const sigA = new RegExp(`export\\s+default\\s+function\\s+${exportName}\\s*\\(\\s*\\)`)
  const sigB = new RegExp(`export\\s+function\\s+${exportName}\\s*\\(\\s*\\)`)
  const sigC = new RegExp(`function\\s+${exportName}\\s*\\(\\s*\\)`)

  const newSig = `${exportName}({ open, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void } = {})`

  if (sigA.test(t)) {
    t = t.replace(sigA, `export default function ${newSig}`)
    changed = true
  } else if (sigB.test(t)) {
    t = t.replace(sigB, `export function ${newSig}`)
    changed = true
  } else if (sigC.test(t)) {
    t = t.replace(sigC, `function ${newSig}`)
    changed = true
  }

  // Make shadcn Dialog controlled
  if (t.includes("<Dialog") && !t.includes("open={open}") && !t.includes("onOpenChange={onOpenChange}")) {
    const reDialog = /<Dialog(?![^>]*\bopen=)([^>]*)>/
    if (reDialog.test(t)) {
      t = t.replace(reDialog, "<Dialog open={open} onOpenChange={onOpenChange}$1>")
      changed = true
    } else if (t.includes("<Dialog>")) {
      t = t.replace("<Dialog>", "<Dialog open={open} onOpenChange={onOpenChange}>")
      changed = true
    }
  }

  fs.writeFileSync(filePath, t, "utf8")
  console.log(changed ? `OK: patched -> ${path.relative(root, filePath)}` : `OK: no changes needed -> ${path.relative(root, filePath)}`)
}

const targets = [
  { fileHint: "ai-chat-dialog", exportName: "AiChatDialog" },
  { fileHint: "voice-call-dialog", exportName: "VoiceCallDialog" },
  { fileHint: "video-call-dialog", exportName: "VideoCallDialog" },
]

for (const t of targets) {
  const p = findComponentFile(t.fileHint)
  if (!p) {
    console.log(`WARN: file not found for ${t.exportName} (hint: ${t.fileHint})`)
    continue
  }
  patchDialogFile(p, t.exportName)
}
