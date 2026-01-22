#!/usr/bin/env node
import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "out", ".git"])
const SKIP_PATH_FRAGMENTS = [
  `${path.sep}lib${path.sep}i18n${path.sep}translations${path.sep}`,
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const it of items) {
    const full = path.join(dir, it.name)
    if (it.isDirectory()) {
      if (SKIP_DIRS.has(it.name)) continue
      walk(full, out)
    } else {
      if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full)
    }
  }
  return out
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Replace plain text between tags only:
 * > TEXT <  => > {t("...")} <
 */
function replaceBetweenTags(txt, plain, replacementJSX) {
  const re = new RegExp(`>(\\s*)${esc(plain)}(\\s*)<`, "g")
  return txt.replace(re, `>$1${replacementJSX}$2<`)
}

/**
 * Replace a <p ...> ... Have questions about TurbotaAI ... </p>
 * into <p ...>{t("Contact page subtitle")}</p>
 */
function replaceContactsHeroSubtitle(txt) {
  const re = /(<p[^>]*>)[\s\S]*?Have questions about TurbotaAI[\s\S]*?(<\/p>)/m
  if (!re.test(txt)) return txt
  return txt.replace(re, `$1{t("Contact page subtitle")}$2`)
}

/**
 * Trial left badge: Trial left: {trialLeft}
 */
function replaceTrialLeft(txt) {
  if (!txt.includes("Trial left:")) return txt
  // Safe replace only when it looks like JSX text
  return txt.replace(/Trial left:\s*\{([^}]+)\}/g, `{t("Trial left")}: {$1}`)
}

/**
 * Upsert translations into lib/i18n/translations/{en,uk,ru}.ts
 */
function ensureKey(file, key, value) {
  if (!fs.existsSync(file)) return false
  let t = fs.readFileSync(file, "utf8")

  const keyRe = new RegExp(`\\n\\s*["']${esc(key)}["']\\s*:`, "m")
  if (keyRe.test(t)) return false

  const insert = `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`
  const idx = t.lastIndexOf("}")
  if (idx === -1) return false

  t = t.slice(0, idx) + insert + t.slice(idx)
  fs.writeFileSync(file, t, "utf8")
  return true
}

const APP_FILES = [
  ...walk(path.join(ROOT, "app")),
  ...walk(path.join(ROOT, "components")),
].filter((f) => !SKIP_PATH_FRAGMENTS.some((x) => f.includes(x)))

let patched = 0

for (const file of APP_FILES) {
  let txt = fs.readFileSync(file, "utf8")
  const before = txt

  // Contacts page: English subtitle from screenshot
  txt = replaceContactsHeroSubtitle(txt)

  // Pricing page leftovers (UA pieces visible in RU mode)
  txt = replaceBetweenTags(txt, "Щомісяця", `{t("Monthly")}`)
  txt = replaceBetweenTags(txt, "Необмежений доступ до чату, голосу та відео", `{t("Unlimited access to chat, voice and video")}`)
  txt = replaceBetweenTags(txt, "Необмежена кількість запитів", `{t("Unlimited number of questions")}`)
  txt = replaceBetweenTags(txt, "Чат, голос і відео", `{t("Chat, voice and video")}`)
  txt = replaceBetweenTags(txt, "Історія зберігається у профілі", `{t("History is saved in your profile")}`)
  txt = replaceBetweenTags(txt, "Залишилось тріалу", `{t("Trial left")}`)
  txt = replaceBetweenTags(txt, "Відкрити профіль", `{t("Open profile")}`)
  txt = replaceBetweenTags(txt, "Активувати промо", `{t("Activate promo")}`)
  txt = replaceBetweenTags(txt, "12 місяців безкоштовного доступу за промокодом", `{t("12 months of free access with promo code")}`)
  txt = replaceBetweenTags(txt, "Активізація промокоду потребує входу.", `{t("Promo code activation requires sign in.")}`)
  txt = replaceBetweenTags(txt, "Guest", `{t("Guest")}`)

  // Contacts emergency card (RU text sitting in UA page)
  txt = replaceBetweenTags(
    txt,
    "В экстренных ситуациях обращайтесь в местные службы спасения или на кризисную линию вашей страны. TurbotaAI не заменяет неотложную медицинскую помощь.",
    `{t("In emergencies, contact your local emergency services or your country's crisis hotline. TurbotaAI is not a substitute for emergency medical care.")}`
  )

  // Widget (mixed UA strings in RU mode)
  txt = replaceBetweenTags(txt, "Як тобі зараз зручніше почати розмову?", `{t("How would you like to start the conversation?")}`)
  txt = replaceBetweenTags(txt, "Текстова розмова", `{t("Text conversation")}`)
  txt = replaceBetweenTags(txt, "Поговорити зараз", `{t("Talk now")}`)
  txt = replaceBetweenTags(txt, "Відео", `{t("Video")}`)
  txt = replaceBetweenTags(txt, "Формат з аватаром", `{t("Avatar format")}`)
  txt = replaceBetweenTags(txt, "Створено командою TurbotaAI", `{t("Created by TurbotaAI Team")}`)
  txt = replaceBetweenTags(txt, "Создано командой TurbotaAI", `{t("Created by TurbotaAI Team")}`)

  // Footer quick links (UA pieces visible)
  txt = replaceBetweenTags(txt, "Швидкі посилання", `{t("Quick links")}`)
  txt = replaceBetweenTags(txt, "Головна", `{t("Home")}`)
  txt = replaceBetweenTags(txt, "Про нас", `{t("About")}`)
  txt = replaceBetweenTags(txt, "Контакти", `{t("Contacts")}`)
  txt = replaceBetweenTags(txt, "Тарифи", `{t("Pricing")}`)
  txt = replaceBetweenTags(txt, "Зв'яжіться з нами", `{t("Contact us")}`)

  // Trial left badge (header)
  if (txt.includes("Trial left:")) txt = replaceTrialLeft(txt)

  if (txt !== before) {
    fs.writeFileSync(file, txt, "utf8")
    console.log("OK patched ->", path.relative(ROOT, file))
    patched++
  }
}

console.log("DONE patched files:", patched)

// ---- translations upsert ----
const enFile = path.join(ROOT, "lib/i18n/translations/en.ts")
const ukFile = path.join(ROOT, "lib/i18n/translations/uk.ts")
const ruFile = path.join(ROOT, "lib/i18n/translations/ru.ts")

const PACK = [
  { key: "Trial left", en: "Trial left", uk: "Залишилось спроб", ru: "Осталось проб" },
  { key: "Monthly", en: "Monthly", uk: "Щомісяця", ru: "Ежемесячно" },
  { key: "Unlimited access to chat, voice and video", en: "Unlimited access to chat, voice and video", uk: "Необмежений доступ до чату, голосу та відео", ru: "Неограниченный доступ к чату, голосу и видео" },
  { key: "Unlimited number of questions", en: "Unlimited number of questions", uk: "Необмежена кількість запитів", ru: "Неограниченное количество запросов" },
  { key: "Chat, voice and video", en: "Chat, voice and video", uk: "Чат, голос і відео", ru: "Чат, голос и видео" },
  { key: "History is saved in your profile", en: "History is saved in your profile", uk: "Історія зберігається у профілі", ru: "История сохраняется в профиле" },
  { key: "Open profile", en: "Open profile", uk: "Відкрити профіль", ru: "Открыть профиль" },
  { key: "Activate promo", en: "Activate promo", uk: "Активувати промо", ru: "Активировать промо" },
  { key: "12 months of free access with promo code", en: "12 months of free access with promo code", uk: "12 місяців безкоштовного доступу за промокодом", ru: "12 месяцев бесплатного доступа по промокоду" },
  { key: "Promo code activation requires sign in.", en: "Promo code activation requires sign in.", uk: "Активація промокоду потребує входу.", ru: "Для активации промокода нужен вход." },
  { key: "Guest", en: "Guest", uk: "Гість", ru: "Гость" },

  { key: "Contact page subtitle", en: "Have questions about TurbotaAI, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.", uk: "Маєте запитання про роботу TurbotaAI, партнерство чи ваш акаунт? Напишіть нам і ми відповімо якнайшвидше.", ru: "Есть вопросы о работе TurbotaAI, партнёрстве или нужна помощь с аккаунтом? Напишите нам — мы ответим как можно быстрее." },
  { key: "In emergencies, contact your local emergency services or your country's crisis hotline. TurbotaAI is not a substitute for emergency medical care.", en: "In emergencies, contact your local emergency services or your country's crisis hotline. TurbotaAI is not a substitute for emergency medical care.", uk: "В екстрених ситуаціях звертайтеся до місцевих служб порятунку або на кризову лінію вашої країни. TurbotaAI не є заміною невідкладної медичної допомоги.", ru: "В экстренных ситуациях обращайтесь в местные службы спасения или на кризисную линию вашей страны. TurbotaAI не заменяет неотложную медицинскую помощь." },

  { key: "How would you like to start the conversation?", en: "How would you like to start the conversation?", uk: "Як Вам зручніше почати розмову?", ru: "Как Вам удобнее начать разговор?" },
  { key: "Text conversation", en: "Text conversation", uk: "Текстова розмова", ru: "Текстовый разговор" },
  { key: "Talk now", en: "Talk now", uk: "Поговорити зараз", ru: "Поговорить сейчас" },
  { key: "Video", en: "Video", uk: "Відео", ru: "Видео" },
  { key: "Avatar format", en: "Avatar format", uk: "Формат з аватаром", ru: "Формат с аватаром" },
  { key: "Created by TurbotaAI Team", en: "Created by TurbotaAI Team", uk: "Створено командою TurbotaAI", ru: "Создано командой TurbotaAI" },

  { key: "Quick links", en: "Quick links", uk: "Швидкі посилання", ru: "Быстрые ссылки" },
  { key: "Contact us", en: "Contact us", uk: "Зв'яжіться з нами", ru: "Связаться с нами" },
]

let tr = 0
for (const row of PACK) {
  tr += ensureKey(enFile, row.key, row.en) ? 1 : 0
  tr += ensureKey(ukFile, row.key, row.uk) ? 1 : 0
  tr += ensureKey(ruFile, row.key, row.ru) ? 1 : 0
}

console.log("DONE translations upserted:", tr)
console.log("Files:", { enFile, ukFile, ruFile })
