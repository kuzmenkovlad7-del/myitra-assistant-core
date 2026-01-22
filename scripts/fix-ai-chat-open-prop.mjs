import fs from "fs"
import path from "path"

const root = process.cwd()
const file = path.join(root, "components/ai-chat-dialog.tsx")

let t = fs.readFileSync(file, "utf8")
const before = t

// 1) гарантируем, что компонент принимает props (если было AiChatDialog())
t = t.replace(
  /export\s+(default\s+)?function\s+AiChatDialog\s*\(\s*\)\s*\{/,
  (m, def) =>
    `export ${def ? "default " : ""}function AiChatDialog(props: { open?: boolean; onOpenChange?: (v: boolean) => void } = {}) {\n  const { open, onOpenChange } = props\n`
)

// 2) если где-то осталось open ?? isOpen — делаем строго boolean
t = t.replace(
  /open=\{open\s*\?\?\s*isOpen\}/g,
  'open={(typeof open === "boolean" ? open : undefined) ?? isOpen}'
)

if (t !== before) {
  fs.writeFileSync(file, t, "utf8")
  console.log("OK patched -> components/ai-chat-dialog.tsx")
} else {
  console.log("OK no changes -> components/ai-chat-dialog.tsx")
}
