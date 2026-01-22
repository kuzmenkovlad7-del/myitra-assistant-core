import fs from "fs"
import path from "path"

const targets = [
  "components/ai-chat-dialog.tsx",
  "components/voice-call-dialog.tsx",
]

function patchFile(fileRel) {
  const file = path.resolve(process.cwd(), fileRel)
  if (!fs.existsSync(file)) {
    console.log("WARN missing ->", fileRel)
    return
  }

  const before = fs.readFileSync(file, "utf8")
  let t = before

  // 0) убираем наши старые вставки (если они были)
  t = t.replace(/\n\s*const __props: any =[\s\S]*?extOnOpenChange:[\s\S]*?\n\n/gm, "\n\n")
  t = t.replace(/\n\s*const controlledOpen =[\s\S]*?\n/gm, "\n")
  t = t.replace(/\n\s*const extOnOpenChange =[\s\S]*?\n/gm, "\n")

  // 1) в Dialog open должны использовать controlledOpen ?? isOpen
  t = t.replace(/open=\{[^}]*\?\?\s*isOpen\}/g, "open={controlledOpen ?? isOpen}")

  // 2) onOpenChange должен дергать extOnOpenChange и закрывать
  // приводим к единому виду
  t = t.replace(
    /onOpenChange=\{\(v\)\s*=>\s*\{[\s\S]*?\}\}/m,
    'onOpenChange={(v) => { extOnOpenChange?.(v); if (!v) onClose(); }}'
  )

  // 3) вставляем гарантированное определение controlledOpen/extOnOpenChange
  const marker = "\n  return ("
  const idx = t.lastIndexOf(marker)
  if (idx !== -1) {
    const insert =
      "\n  const __props: any = (typeof arguments !== \"undefined\" ? (arguments as any)[0] : undefined)\n" +
      "  const controlledOpen: boolean | undefined = typeof __props?.open === \"boolean\" ? __props.open : undefined\n" +
      "  const extOnOpenChange: ((v: boolean) => void) | undefined = typeof __props?.onOpenChange === \"function\" ? __props.onOpenChange : undefined\n\n"
    t = t.slice(0, idx) + insert + t.slice(idx)
  }

  // 4) если где-то остались ссылки на несуществующие переменные — подчистим
  t = t.replace(/\bopen\s*\?\?\s*isOpen\b/g, "controlledOpen ?? isOpen")
  t = t.replace(/onOpenChange\?\.\(v\);/g, "extOnOpenChange?.(v);")

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", fileRel)
  } else {
    console.log("OK no changes ->", fileRel)
  }
}

for (const f of targets) patchFile(f)
