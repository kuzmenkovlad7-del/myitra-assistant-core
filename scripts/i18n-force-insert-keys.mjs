import fs from "fs"
import path from "path"

const root = process.cwd()

const KEYS = [
  [
    "TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace.",
    {
      en: "TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace.",
      uk: "Спокійний і безпечний простір для розмови. Поговори, заспокойся і відчуй підтримку з AI, створеним для емоційної турботи.",
      ru: "Спокойное и безопасное пространство для разговора. Поговори, успокойся и почувствуй поддержку с AI, созданным для эмоциональной заботы.",
    },
  ],
  [
    "Write how we can help",
    {
      en: "Write how we can help",
      uk: "Напишіть чим ми можемо допомогти",
      ru: "Напишите, чем мы можем помочь",
    },
  ],
]

function injectIntoObject(fileRel, lang) {
  const file = path.join(root, fileRel)
  let t = fs.readFileSync(file, "utf8")
  const before = t

  // ищем начало главного объекта переводов
  const m =
    t.match(/export\s+default\s*\{\s*\n/) ||
    t.match(/export\s+const\s+\w+\s*=\s*\{\s*\n/) ||
    t.match(/const\s+\w+\s*=\s*\{\s*\n/)

  if (!m) {
    console.log("ERROR: cannot find translations object start in", fileRel)
    return
  }

  const start = m.index + m[0].length
  const head = t.slice(0, start)
  const tail = t.slice(start)

  // НЕ проверяем “есть ли ключ в файле вообще”, потому что он мог вставиться мимо объекта
  // Вставляем в начало объекта аккуратно (если уже есть внутри объекта — ничего страшного)
  let ins = ""
  for (const [key, vals] of KEYS) {
    const val = vals[lang]
    ins += `  "${key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}": "${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}",\n`
  }

  t = head + ins + tail

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK injected ->", fileRel)
  } else {
    console.log("OK no changes ->", fileRel)
  }
}

injectIntoObject("lib/i18n/translations/en.ts", "en")
injectIntoObject("lib/i18n/translations/uk.ts", "uk")
injectIntoObject("lib/i18n/translations/ru.ts", "ru")
