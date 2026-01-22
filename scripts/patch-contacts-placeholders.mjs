import fs from "fs"
import path from "path"

const root = process.cwd()

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (p.endsWith(".tsx")) out.push(p)
  }
  return out
}

const files = [...walk(path.join(root, "app")), ...walk(path.join(root, "components"))]

const variants = [
  "Коротко опишіть свій запит або ідею.",
  "Коротко опишіть свій запит",
  "Briefly describe your request or idea.",
  "Briefly describe your request",
]

let changed = 0

for (const f of files) {
  let t = fs.readFileSync(f, "utf8")
  const before = t

  for (const v of variants) {
    t = t.replaceAll(v, "Напишіть чим ми можемо допомогти")
  }

  if (t !== before) {
    fs.writeFileSync(f, t, "utf8")
    changed++
  }
}

console.log("OK: contacts placeholders patched in files:", changed)
