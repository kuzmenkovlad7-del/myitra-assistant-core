import fs from "fs"
import path from "path"

const root = process.cwd()

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (p.endsWith(".tsx")) out.push(p)
  }
  return out
}

function replaceInTsx() {
  const files = [...walk(path.join(root, "app")), ...walk(path.join(root, "components"))]
  let changed = 0

  for (const f of files) {
    let t = fs.readFileSync(f, "utf8")
    const before = t

    // если где-то стало t("Напишіть чим ми можемо допомогти") — возвращаем нормальный ключ
    t = t.replaceAll('t("Напишіть чим ми можемо допомогти")', 't("Write how we can help")')

    if (t !== before) {
      fs.writeFileSync(f, t, "utf8")
      changed++
    }
  }

  console.log("OK: patched tsx files =", changed)
}

function insertKey(fileRel, key, value) {
  const file = path.join(root, fileRel)
  let t = fs.readFileSync(file, "utf8")
  if (t.includes(`"${key}":`)) return false

  // вставляем перед последней закрывающей }
  t = t.replace(/\n}\s*$/, `  "${key}": "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}",\n}\n`)
  fs.writeFileSync(file, t, "utf8")
  return true
}

replaceInTsx()

const okEN = insertKey("lib/i18n/translations/en.ts", "Write how we can help", "Write how we can help")
const okUK = insertKey("lib/i18n/translations/uk.ts", "Write how we can help", "Напишіть чим ми можемо допомогти")
const okRU = insertKey("lib/i18n/translations/ru.ts", "Write how we can help", "Напишите, чем мы можем помочь")

console.log("OK: inserted key in EN:", okEN)
console.log("OK: inserted key in UK:", okUK)
console.log("OK: inserted key in RU:", okRU)
