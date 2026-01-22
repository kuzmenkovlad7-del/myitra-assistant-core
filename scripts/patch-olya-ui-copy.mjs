import fs from "fs"
import path from "path"

const root = process.cwd()

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function setTsMapValue(file, key, value) {
  let t = fs.readFileSync(file, "utf8")
  const k = escRe(key)
  const re = new RegExp(`("${k}"\\s*:\\s*)"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, "m")

  if (!re.test(t)) {
    console.log(`WARN: key not found in ${path.relative(root, file)} -> ${key}`)
    return
  }

  const safe = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  t = t.replace(re, `$1"${safe}"`)
  fs.writeFileSync(file, t, "utf8")
  console.log(`OK: patched key in ${path.relative(root, file)} -> ${key}`)
}

function replaceInAllTsx(search, replace) {
  const all = []
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (p.endsWith(".tsx") || p.endsWith(".ts")) all.push(p)
    }
  }
  walk(path.join(root, "app"))
  walk(path.join(root, "components"))

  let touched = 0
  for (const f of all) {
    let t = fs.readFileSync(f, "utf8")
    if (!t.includes(search)) continue
    t = t.split(search).join(replace)
    fs.writeFileSync(f, t, "utf8")
    touched++
  }
  console.log(`OK: replaced "${search}" -> "${replace}" in ${touched} files`)
}

// ====== Translations patches (what you see on screenshots) ======
const ukFile = path.join(root, "lib/i18n/translations/uk.ts")
const ruFile = path.join(root, "lib/i18n/translations/ru.ts")

// Header menu / basic nav
setTsMapValue(ukFile, "Contacts", "Контакти")
setTsMapValue(ukFile, "Home", "Головна")
setTsMapValue(ukFile, "About", "Про сервіс")
setTsMapValue(ukFile, "Pricing", "Тарифи")

setTsMapValue(ruFile, "Contacts", "Контакты")
setTsMapValue(ruFile, "Home", "Главная")
setTsMapValue(ruFile, "About", "О сервисе")
setTsMapValue(ruFile, "Pricing", "Тарифы")

// Hero block (main title + subtitle)
setTsMapValue(ukFile, "Support for everyday conversations, powered by AI", "AI співрозмовник, який завжди поруч.")
setTsMapValue(
  ukFile,
  "TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace.",
  "Спокійний і безпечний простір для розмови. Поговори, заспокойся і відчуй підтримку з AI, створеним для емоційної турботи."
)

setTsMapValue(ruFile, "Support for everyday conversations, powered by AI", "AI-собеседник, который всегда рядом.")
setTsMapValue(
  ruFile,
  "TurbotaAI listens carefully, asks gentle clarifying questions and helps you take the next step at your own pace.",
  "Спокойное и безопасное пространство для разговора. Поговорите, успокойтесь и почувствуйте поддержку с AI, созданным для эмоциональной заботы."
)

// Contacts page subtitle (English line was showing in UA)
setTsMapValue(
  ukFile,
  "Have questions about how the AI companion works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.",
  "Маєте запитання про роботу TurbotaAi, партнерство чи ваш акаунт? Напишіть нам і ми відповімо вам якомога швидше."
)

setTsMapValue(
  ruFile,
  "Have questions about how the AI companion works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.",
  "Есть вопросы о работе TurbotaAi, партнёрстве или нужна помощь с аккаунтом? Напишите нам — мы ответим как можно быстрее."
)

// Placeholders in contact form
replaceInAllTsx("you@example.com", "You@email.com")
replaceInAllTsx("Коротко опишіть свій запит або ідею.", "Напишіть чим ми можемо допомогти")

