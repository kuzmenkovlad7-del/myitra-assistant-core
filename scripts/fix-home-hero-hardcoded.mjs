import fs from "fs"
import path from "path"

const root = process.cwd()

const hero = path.join(root, "components/home-hero.tsx")
if (fs.existsSync(hero)) {
  let t = fs.readFileSync(hero, "utf8")
  const before = t

  const plain = `"TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace.",`
  const rep = `t("TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace."),`

  if (t.includes(plain)) {
    t = t.replace(plain, rep)
    fs.writeFileSync(hero, t, "utf8")
    console.log("OK patched -> components/home-hero.tsx")
  } else {
    console.log("OK no changes -> components/home-hero.tsx")
  }
}

function patchValueOnly(fileRel, key, value) {
  const file = path.join(root, fileRel)
  let t = fs.readFileSync(file, "utf8")
  const re = new RegExp(`(^\\s*"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*")(.*?)(",\\s*$)`, "m")
  if (!re.test(t)) {
    // если ключа нет — вставим перед закрывающей }
    t = t.replace(/\n}\s*$/, `  "${key}": "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}",\n}\n`)
    fs.writeFileSync(file, t, "utf8")
    return "inserted"
  }
  t = t.replace(re, `$1${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}$3`)
  fs.writeFileSync(file, t, "utf8")
  return "updated"
}

const key = "TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace."
console.log("EN:", patchValueOnly("lib/i18n/translations/en.ts", key, "TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace."))
console.log("UK:", patchValueOnly("lib/i18n/translations/uk.ts", key, "Спокійний і безпечний простір для розмови. Поговори, заспокойся і відчуй підтримку з AI, створеним для емоційної турботи."))
console.log("RU:", patchValueOnly("lib/i18n/translations/ru.ts", key, "Спокойное и безопасное пространство для разговора. Поговори, успокойся и почувствуй поддержку с AI, созданным для эмоциональной заботы."))
