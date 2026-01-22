import fs from "fs"
import path from "path"

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}
function write(rel, txt) {
  fs.writeFileSync(path.join(root, rel), txt, "utf8")
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function patchSig(txt, name) {
  // export default function X()
  txt = txt.replace(
    new RegExp(`export\\s+default\\s+function\\s+${name}\\s*\\(\\s*\\)`, "m"),
    `export default function ${name}({ open: controlledOpen, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void } = {})`
  )

  // export function X()
  txt = txt.replace(
    new RegExp(`export\\s+function\\s+${name}\\s*\\(\\s*\\)`, "m"),
    `export function ${name}({ open: controlledOpen, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void } = {})`
  )

  return txt
}

function patchDialogOpen(txt) {
  // если раньше было open={open ?? isOpen} и open брался как window.open
  txt = txt.replace(/open=\{open\s*\?\?\s*isOpen\}/g, "open={controlledOpen ?? isOpen}")
  txt = txt.replace(/open=\{open\}/g, "open={controlledOpen}")
  return txt
}

function patchDialogOnOpenChange(txt) {
  // добавляем вызов onOpenChange?.(v) если его нет
  // стараемся не ломать существующую логику
  txt = txt.replace(
    /onOpenChange=\{\(v\)\s*=>\s*\{/g,
    "onOpenChange={(v) => { onOpenChange?.(v);"
  )
  txt = txt.replace(
    /onOpenChange=\{\(open\)\s*=>\s*\{/g,
    "onOpenChange={(v) => { onOpenChange?.(v);"
  )
  txt = txt.replace(/if\s*\(!open\)/g, "if (!v)")
  txt = txt.replace(/if\s*\(open\)/g, "if (v)")
  return txt
}

function patchFile(rel, name) {
  if (!exists(rel)) {
    console.log("SKIP (not found):", rel)
    return
  }
  let t = read(rel)
  const before = t

  t = patchSig(t, name)
  t = patchDialogOpen(t)
  t = patchDialogOnOpenChange(t)

  if (t !== before) {
    write(rel, t)
    console.log("OK patched ->", rel)
  } else {
    console.log("OK no changes ->", rel)
  }
}

patchFile("components/ai-chat-dialog.tsx", "AiChatDialog")
patchFile("components/voice-call-dialog.tsx", "VoiceCallDialog")
patchFile("components/video-call-dialog.tsx", "VideoCallDialog")
