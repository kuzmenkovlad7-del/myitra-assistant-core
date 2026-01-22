import fs from "fs"
import path from "path"

const root = process.cwd()

function patchFile(rel, fn) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) {
    console.log("SKIP (not found):", rel)
    return
  }
  const before = fs.readFileSync(file, "utf8")
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8")
    console.log("OK patched ->", rel)
  } else {
    console.log("OK no changes ->", rel)
  }
}

// 1) FIX broken <Dialog ...Content> -> <DialogContent
const fixBrokenDialogContent = (t) => {
  t = t.replaceAll("<Dialog open={open} onOpenChange={onOpenChange}Content", "<DialogContent")
  t = t.replace(/<Dialog\s+open=\{open\}\s+onOpenChange=\{onOpenChange\}\s*Content/g, "<DialogContent")
  return t
}

// 2) make Dialog controlled safely (use open ?? isOpen) and call onOpenChange
patchFile("components/ai-chat-dialog.tsx", (t) => {
  t = fixBrokenDialogContent(t)

  // replace ONLY exact <Dialog ...> tag (not DialogContent)
  t = t.replace(
    /<Dialog\s+open=\{isOpen\}\s+onOpenChange=\{\(open\)\s*=>\s*!open\s*&&\s*onClose\(\)\}\s*>/g,
    "<Dialog open={open ?? isOpen} onOpenChange={(v) => { onOpenChange?.(v); if (!v) onClose(); }}>"
  )

  return t
})

patchFile("components/voice-call-dialog.tsx", (t) => {
  t = fixBrokenDialogContent(t)

  // open={isOpen} -> open={open ?? isOpen}
  t = t.replace(/open=\{isOpen\}/g, "open={open ?? isOpen}")

  // add onOpenChange?.(v) and rename callback param open -> v
  t = t.replace(/onOpenChange=\{\(open\)\s*=>\s*\{/g, "onOpenChange={(v) => { onOpenChange?.(v);")
  t = t.replace(/if\s*\(!open\)/g, "if (!v)")
  t = t.replace(/if\s*\(open\)/g, "if (v)")

  return t
})
