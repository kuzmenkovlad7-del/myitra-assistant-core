import fs from "fs"
import path from "path"

const enPath = path.resolve("lib/i18n/translations/en.ts")
const ukPath = path.resolve("lib/i18n/translations/uk.ts")
const ruPath = path.resolve("lib/i18n/translations/ru.ts")

function loadObj(file) {
  const src = fs.readFileSync(file, "utf8")
  const m = src.match(/export\s+const\s+\w+\s*=\s*\{([\s\S]*?)\}\s*as\s+const\s*;?/m)
  if (!m) throw new Error("Cannot parse " + file)

  // очень простой парсер для формата "key": "value",
  const body = m[1]
  const obj = {}
  const re = /"([^"]+)":\s*"([^"]*)"/g
  let mm
  while ((mm = re.exec(body))) obj[mm[1]] = mm[2]
  return obj
}

const en = loadObj(enPath)
const uk = loadObj(ukPath)
const ru = loadObj(ruPath)

function isEnglishLike(s) {
  return /[A-Za-z]/.test(s)
}

const outUK = []
const outRU = []

for (const k of Object.keys(en)) {
  const ev = en[k]
  const ukv = uk[k]
  const ruv = ru[k]
  if (typeof ukv === "string" && ukv === ev && isEnglishLike(ev)) outUK.push(`${k}  ==>  ${ev}`)
  if (typeof ruv === "string" && ruv === ev && isEnglishLike(ev)) outRU.push(`${k}  ==>  ${ev}`)
}

fs.mkdirSync("tmp", { recursive: true })
fs.writeFileSync("tmp/i18n-untranslated-UK.txt", outUK.join("\n") + "\n", "utf8")
fs.writeFileSync("tmp/i18n-untranslated-RU.txt", outRU.join("\n") + "\n", "utf8")

console.log("OK: reports generated:")
console.log(" - tmp/i18n-untranslated-UK.txt =", outUK.length)
console.log(" - tmp/i18n-untranslated-RU.txt =", outRU.length)
