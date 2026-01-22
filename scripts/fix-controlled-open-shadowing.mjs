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

  // 1) Переименовываем destructuring, чтобы не использовать голое `open`
  //    { open, onOpenChange } -> { open: controlledOpen, onOpenChange }
  t = t.replace(
    /const\s*\{\s*open\s*,\s*onOpenChange\s*\}\s*=\s*([a-zA-Z0-9_$.]+)/,
    "const { open: controlledOpen, onOpenChange } = $1"
  )
  t = t.replace(
    /const\s*\{\s*open\s*\}\s*=\s*([a-zA-Z0-9_$.]+)/,
    "const { open: controlledOpen } = $1"
  )

  // 2) Если open в аргументах компонента: ({ open, onOpenChange }) -> ({ open: controlledOpen, onOpenChange })
  t = t.replace(
    /\(\s*\{\s*open\s*,\s*onOpenChange\s*\}\s*\)/,
    "({ open: controlledOpen, onOpenChange })"
  )
  t = t.replace(
    /\(\s*\{\s*open\s*\}\s*\)/,
    "({ open: controlledOpen })"
  )

  // 3) Убираем двойной вызов onOpenChange?.(v) если где-то задвоилось
  t = t.replace(/onOpenChange\?\.\(v\);\s*onOpenChange\?\.\(v\);/g, "onOpenChange?.(v);")

  // 4) Меняем open-проп в <Dialog ...>
  //    open={(typeof open === "boolean" ? open : undefined) ?? isOpen}
  // -> open={(typeof controlledOpen === "boolean" ? controlledOpen : undefined) ?? isOpen}
  t = t.replace(
    /open=\{\s*\(typeof open === "boolean"\s*\?\s*open\s*:\s*undefined\)\s*\?\?\s*isOpen\s*\}/g,
    'open={(typeof controlledOpen === "boolean" ? controlledOpen : undefined) ?? isOpen}'
  )

  // open={open ?? isOpen} -> open={controlledOpen ?? isOpen}
  t = t.replace(
    /open=\{\s*open\s*\?\?\s*isOpen\s*\}/g,
    "open={controlledOpen ?? isOpen}"
  )

  // 5) Если controlledOpen используется, но не объявлен (на всякий случай) — инжектим перед return
  const usesControlledOpen = t.includes("controlledOpen")
  const hasControlledOpenDecl =
    t.includes("open: controlledOpen") ||
    /\bcontrolledOpen\b\s*=/.test(t)

  if (usesControlledOpen && !hasControlledOpenDecl) {
    t = t.replace(
      /(\n\s*)return\s*\(/,
      `$1const controlledOpen = (typeof (open as any) === "boolean" ? (open as any) : undefined) as boolean | undefined\n$1return (`
    )
  }

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", fileRel)
  } else {
    console.log("OK no changes ->", fileRel)
  }
}

for (const f of targets) patchFile(f)
