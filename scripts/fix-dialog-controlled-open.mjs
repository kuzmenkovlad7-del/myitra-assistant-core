import fs from "fs"
import path from "path"

const root = process.cwd()

function patch(rel, name) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) {
    console.log("SKIP:", rel)
    return
  }

  let t = fs.readFileSync(file, "utf8")
  const before = t

  // 1) если где-то остался controlledOpen — приводим всё к prop open
  t = t.replace(/\bcontrolledOpen\b/g, "open")

  // 2) чиним JSX open={...}
  t = t.replace(/open=\{open\s*\?\?\s*isOpen\}/g, "open={open ?? isOpen}")
  t = t.replace(/open=\{open\}/g, "open={open}")

  // 3) убираем двойной вызов onOpenChange?.(v)
  t = t.replace(/onOpenChange\?\.\(v\);\s*onOpenChange\?\.\(v\);/g, "onOpenChange?.(v);")

  // 4) гарантируем сигнатуру компонента с open/onOpenChange (если вдруг не встало)
  const sig1 = new RegExp(`export\\s+function\\s+${name}\\s*\\(\\s*\\)`, "m")
  const sig2 = new RegExp(`export\\s+default\\s+function\\s+${name}\\s*\\(\\s*\\)`, "m")

  if (sig1.test(t)) {
    t = t.replace(
      sig1,
      `export function ${name}({ open, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void } = {})`
    )
  }
  if (sig2.test(t)) {
    t = t.replace(
      sig2,
      `export default function ${name}({ open, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void } = {})`
    )
  }

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", rel)
  } else {
    console.log("OK no changes ->", rel)
  }
}

patch("components/ai-chat-dialog.tsx", "AiChatDialog")
patch("components/voice-call-dialog.tsx", "VoiceCallDialog")
