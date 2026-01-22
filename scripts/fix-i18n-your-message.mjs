import fs from "fs"

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function patchValueOnly(file, key, value) {
  let t = fs.readFileSync(file, "utf8")
  const before = t

  const k = escRe(key)
  const re = new RegExp(`(["']${k}["']\\s*:\\s*)["'][^"']*["']`, "g")
  t = t.replace(re, `$1"${value.replace(/"/g, '\\"')}"`)

  if (t !== before) fs.writeFileSync(file, t, "utf8")
  return t !== before
}

function insertKeyIfMissing(file, objName, key, value) {
  let t = fs.readFileSync(file, "utf8")
  const before = t

  const needle = new RegExp(`["']${escRe(key)}["']\\s*:`, "m")
  if (needle.test(t)) return false

  const objRe = new RegExp(`(export\\s+const\\s+${escRe(objName)}\\s*=\\s*\\{)`, "m")
  if (!objRe.test(t)) return false

  t = t.replace(objRe, `$1\n  "${key.replace(/"/g, '\\"')}": "${value.replace(/"/g, '\\"')}",`)

  if (t !== before) fs.writeFileSync(file, t, "utf8")
  return t !== before
}

const files = {
  en: "lib/i18n/translations/en.ts",
  uk: "lib/i18n/translations/uk.ts",
  ru: "lib/i18n/translations/ru.ts",
}

const key = "Your Message"

const pack = {
  en: "Your message",
  uk: "Ваше повідомлення",
  ru: "Ваше сообщение",
}

// вставка если вдруг ключа нет + точечная замена значения
insertKeyIfMissing(files.en, "en", key, pack.en)
insertKeyIfMissing(files.uk, "uk", key, pack.uk)
insertKeyIfMissing(files.ru, "ru", key, pack.ru)

patchValueOnly(files.en, key, pack.en)
patchValueOnly(files.uk, key, pack.uk)
patchValueOnly(files.ru, key, pack.ru)

console.log("OK fixed i18n key:", key)
