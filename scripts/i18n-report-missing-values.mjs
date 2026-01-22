import fs from "fs"
import path from "path"

const root = process.cwd()

function readMap(file) {
  const t = fs.readFileSync(file, "utf8")
  const map = new Map()
  const re = /"([^"]+)"\s*:\s*"((?:\\.|[^"\\])*)"/g
  let m
  while ((m = re.exec(t))) {
    const key = m[1]
    const val = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    map.set(key, val)
  }
  return map
}

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p)
  }
  return out
}

function usedTKeys() {
  const files = [
    ...walk(path.join(root, "app")),
    ...walk(path.join(root, "components")),
    ...walk(path.join(root, "lib")),
  ].filter((f) => !f.includes("node_modules"))

  const keys = new Set()
  const re = /t\(\s*["'`]([^"'`]+)["'`]\s*\)/g
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8")
    let m
    while ((m = re.exec(t))) keys.add(m[1])
  }
  return keys
}

const en = readMap(path.join(root, "lib/i18n/translations/en.ts"))
const uk = readMap(path.join(root, "lib/i18n/translations/uk.ts"))
const ru = readMap(path.join(root, "lib/i18n/translations/ru.ts"))

const used = usedTKeys()

function report(langName, dict) {
  const out = []
  for (const k of used) {
    const enV = en.get(k)
    const v = dict.get(k)
    if (!enV) continue
    if (!v) continue
    if (v.trim() === enV.trim()) {
      out.push({ key: k, en: enV })
    }
  }
  out.sort((a, b) => a.key.localeCompare(b.key))
  return out
}

const missUK = report("UK", uk)
const missRU = report("RU", ru)

fs.mkdirSync(path.join(root, "tmp"), { recursive: true })

fs.writeFileSync(
  path.join(root, "tmp/i18n-missing-UK.txt"),
  missUK.map((x) => `${x.key}  ==>  ${x.en}`).join("\n"),
  "utf8"
)

fs.writeFileSync(
  path.join(root, "tmp/i18n-missing-RU.txt"),
  missRU.map((x) => `${x.key}  ==>  ${x.en}`).join("\n"),
  "utf8"
)

console.log("OK: reports generated:")
console.log(" - tmp/i18n-missing-UK.txt")
console.log(" - tmp/i18n-missing-RU.txt")
console.log("Missing UK count:", missUK.length)
console.log("Missing RU count:", missRU.length)
