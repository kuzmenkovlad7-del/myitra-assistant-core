import fs from "fs"
import path from "path"

const PACK = [
  {
    key: "Company contact information",
    en: "Company contact information",
    uk: "Контактна інформація компанії",
    ru: "Контактная информация компании",
  },
  { key: "Legal name", en: "Legal name", uk: "Повне найменування", ru: "Полное наименование" },
  { key: "Tax ID", en: "Tax ID", uk: "ІПН", ru: "ИНН" },
  { key: "Legal address", en: "Legal address", uk: "Юридична адреса", ru: "Юридический адрес" },
  { key: "Actual address", en: "Actual address", uk: "Фактична адреса", ru: "Фактический адрес" },
  { key: "Phone", en: "Phone", uk: "Телефон", ru: "Телефон" },
  { key: "Email", en: "Email", uk: "Email", ru: "Email" },
]

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function findLangFile(lang) {
  const root = path.join(process.cwd(), "lib", "i18n")
  const files = walk(root).filter((f) =>
    f.match(new RegExp(`\\b${lang}\\.(ts|tsx|js|mjs)$`, "i"))
  )
  // берём тот, где больше всего строк (обычно это реальный словарь)
  let best = null
  let bestSize = -1
  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8")
    const size = txt.split("\n").length
    if (txt.includes("{") && size > bestSize) {
      best = f
      bestSize = size
    }
  }
  return best
}

function upsertKV(file, key, value) {
  let t = fs.readFileSync(file, "utf8")

  const k = JSON.stringify(key)
  const v = JSON.stringify(value)

  // replace existing
  const re = new RegExp(`${k}\\s*:\\s*("([^"\\\\]|\\\\.)*"|'([^'\\\\]|\\\\.)*'|\\\`[\\s\\S]*?\\\`)\\s*,?`, "m")
  if (re.test(t)) {
    t = t.replace(re, `${k}: ${v},`)
    fs.writeFileSync(file, t, "utf8")
    return true
  }

  // insert before last "}" (best effort)
  const tailRe = /}\s*(as const)?\s*;?\s*$/
  if (tailRe.test(t)) {
    t = t.replace(tailRe, `  ${k}: ${v},\n}\n`)
    fs.writeFileSync(file, t, "utf8")
    return true
  }

  return false
}

const enFile = findLangFile("en")
const ukFile = findLangFile("uk")
const ruFile = findLangFile("ru")

if (!enFile || !ukFile || !ruFile) {
  console.log("ERROR: cannot find translation files", { enFile, ukFile, ruFile })
  process.exit(1)
}

let ok = 0
for (const row of PACK) {
  ok += upsertKV(enFile, row.key, row.en) ? 1 : 0
  ok += upsertKV(ukFile, row.key, row.uk) ? 1 : 0
  ok += upsertKV(ruFile, row.key, row.ru) ? 1 : 0
}

console.log("OK translations upserted:", ok)
console.log("Files:", { enFile, ukFile, ruFile })
