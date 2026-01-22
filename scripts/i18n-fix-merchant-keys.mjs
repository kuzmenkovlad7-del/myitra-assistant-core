import fs from "fs"

const FILES = [
  ["lib/i18n/translations/en.ts", {
    "Company contact information": "Company contact information",
    "Legal name": "Legal name",
    "Tax ID": "Tax ID",
    "Legal address": "Legal address",
    "Actual address": "Actual address",
    "Phone": "Phone",
    "Email": "Email",
  }],
  ["lib/i18n/translations/uk.ts", {
    "Company contact information": "Контактна інформація компанії",
    "Legal name": "Повне найменування",
    "Tax ID": "ІПН",
    "Legal address": "Юридична адреса",
    "Actual address": "Фактична адреса",
    "Phone": "Телефон",
    "Email": "Email",
  }],
  ["lib/i18n/translations/ru.ts", {
    "Company contact information": "Контактная информация компании",
    "Legal name": "Полное наименование",
    "Tax ID": "ИНН",
    "Legal address": "Юридический адрес",
    "Actual address": "Фактический адрес",
    "Phone": "Телефон",
    "Email": "Email",
  }],
]

function ensureKey(fileText, key, value) {
  const k1 = JSON.stringify(key) + ":"
  const k2 = `'${key}':`
  if (fileText.includes(k1) || fileText.includes(k2)) return fileText

  // вставляем перед финальной закрывающей } объекта
  // в переводах это обычно ... } as const
  const idx = fileText.lastIndexOf("}")
  if (idx === -1) return fileText

  const insert = `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`
  return fileText.slice(0, idx) + insert + fileText.slice(idx)
}

for (const [file, map] of FILES) {
  let txt = fs.readFileSync(file, "utf8")
  const before = txt
  for (const [k, v] of Object.entries(map)) {
    txt = ensureKey(txt, k, v)
  }
  if (txt !== before) {
    fs.writeFileSync(file, txt, "utf8")
    console.log("OK patched ->", file)
  } else {
    console.log("OK no changes ->", file)
  }
}

console.log("DONE i18n-fix-merchant-keys ✅")
