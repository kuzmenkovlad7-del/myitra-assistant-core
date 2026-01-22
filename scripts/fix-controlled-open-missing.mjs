import fs from "fs"
import path from "path"

const files = [
  "components/ai-chat-dialog.tsx",
  "components/voice-call-dialog.tsx",
]

function patch(fileRel) {
  const file = path.resolve(process.cwd(), fileRel)
  if (!fs.existsSync(file)) {
    console.log("WARN missing ->", fileRel)
    return
  }

  const before = fs.readFileSync(file, "utf8")
  let t = before

  // 1) Если используется controlledOpen, но нет объявления - добавляем его перед return
  const hasControlledOpenRef = t.includes("controlledOpen")
  const hasControlledOpenDecl =
    /\bconst\s+controlledOpen\b/.test(t) ||
    /\blet\s+controlledOpen\b/.test(t)

  if (hasControlledOpenRef && !hasControlledOpenDecl) {
    t = t.replace(
      /\n(\s*)return\s*\(/,
      `\n$1const controlledOpen = (typeof (arguments[0] as any)?.open === "boolean" ? (arguments[0] as any).open : undefined) as boolean | undefined\n$1const extOnOpenChange = ((arguments[0] as any)?.onOpenChange ?? undefined) as ((v: boolean) => void) | undefined\n\n$1return (`
    )
  }

  // 2) Упрощаем open=..., чтобы точно был boolean | undefined
  // open={(typeof controlledOpen === "boolean" ? controlledOpen : undefined) ?? isOpen}
  // -> open={controlledOpen ?? isOpen}
  t = t.replace(
    /open=\{\s*\(typeof controlledOpen === "boolean"\s*\?\s*controlledOpen\s*:\s*undefined\)\s*\?\?\s*isOpen\s*\}/g,
    "open={controlledOpen ?? isOpen}"
  )

  // 3) onOpenChange всегда прокидываем наружу (extOnOpenChange)
  // onOpenChange={(v) => { onOpenChange?.(v); if (!v) onClose(); }}
  // -> onOpenChange={(v) => { extOnOpenChange?.(v); if (!v) onClose(); }}
  t = t.replace(
    /onOpenChange=\{\(v\)\s*=>\s*\{\s*onOpenChange\?\.\(v\);\s*/g,
    "onOpenChange={(v) => { extOnOpenChange?.(v); "
  )

  // убираем случайный дубль если он остался
  t = t.replace(/extOnOpenChange\?\.\(v\);\s*extOnOpenChange\?\.\(v\);/g, "extOnOpenChange?.(v);")

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", fileRel)
  } else {
    console.log("OK no changes ->", fileRel)
  }
}

for (const f of files) patch(f)
