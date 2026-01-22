import fs from "fs"

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function patchValueOnly(file, key, value) {
  let t = fs.readFileSync(file, "utf8")
  const before = t

  const k = escRe(key)

  // меняем только значение у существующего ключа
  const re = new RegExp(`(["']${k}["']\\s*:\\s*)["'][^"']*["']`, "g")
  t = t.replace(re, `$1"${value.replace(/"/g, '\\"')}"`)

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    return true
  }
  return false
}

function insertKeyIfMissing(file, objName, key, value) {
  let t = fs.readFileSync(file, "utf8")
  const before = t

  const needle = new RegExp(`["']${escRe(key)}["']\\s*:`, "m")
  if (needle.test(t)) return false

  // вставляем в объект export const <objName> = { ... }
  const objRe = new RegExp(`(export\\s+const\\s+${escRe(objName)}\\s*=\\s*\\{)`, "m")
  if (!objRe.test(t)) return false

  // вставка сразу после { чтобы не ломать сортировку
  t = t.replace(objRe, `$1\n  "${key.replace(/"/g, '\\"')}": "${value.replace(/"/g, '\\"')}",`)

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    return true
  }
  return false
}

function patchFile(file, fn) {
  let t = fs.readFileSync(file, "utf8")
  const before = t
  t = fn(t)
  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", file)
  } else {
    console.log("OK no changes ->", file)
  }
}

/**
 * 1) Переводы для ключей, которые светились в grep и “Created by team”
 */
const keys = [
  {
    k: "AI companion nearby 24/7",
    en: "AI companion nearby 24/7",
    uk: "AI співрозмовник поруч 24/7",
    ru: "AI-компаньон рядом 24/7",
  },
  {
    k: "TurbotaAI — AI companion that stays nearby when it feels hard",
    en: "TurbotaAI — AI companion that stays nearby when it feels hard",
    uk: "TurbotaAI — AI співрозмовник поруч, коли важко",
    ru: "TurbotaAI — AI-компаньон рядом, когда тяжело",
  },
  {
    k: "Start with a quick chat, a voice call or a video session with our AI companion — choose the format that feels safest right now.",
    en: "Start with a quick chat, a voice call or a video session with our AI companion — choose the format that feels safest right now.",
    uk: "Почніть з короткого чату, голосового або відео-сеансу з AI співрозмовником — оберіть формат, який зараз найбезпечніший для вас.",
    ru: "Начните с короткого чата, голосового или видео-сеанса с AI-компаньоном — выберите формат, который сейчас ощущается самым безопасным.",
  },
  {
    k: "Chat with AI companion",
    en: "Chat with AI companion",
    uk: "Чат з AI співрозмовником",
    ru: "Чат с AI-компаньоном",
  },
  {
    k: "Call AI companion",
    en: "Call AI companion",
    uk: "Подзвонити AI співрозмовнику",
    ru: "Позвонить AI-компаньону",
  },
  {
    k: "Voice session with AI companion",
    en: "Voice session with AI companion",
    uk: "Голосовий сеанс з AI співрозмовником",
    ru: "Голосовой сеанс с AI-компаньоном",
  },
  {
    k: "TurbotaAI — AI companion",
    en: "TurbotaAI — AI companion",
    uk: "TurbotaAI — AI співрозмовник",
    ru: "TurbotaAI — AI-компаньон",
  },
  {
    k: "Created by TurbotaAI Team",
    en: "Created by TurbotaAI Team",
    uk: "Створено командою TurbotaAI",
    ru: "Создано командой TurbotaAI",
  },
  {
    k: "Pricing",
    en: "Pricing",
    uk: "Тарифи",
    ru: "Тарифы",
  },
]

const files = {
  en: "lib/i18n/translations/en.ts",
  uk: "lib/i18n/translations/uk.ts",
  ru: "lib/i18n/translations/ru.ts",
}

let patched = 0
for (const row of keys) {
  // если нет ключа — вставим, если есть — обновим значение
  patched += insertKeyIfMissing(files.en, "en", row.k, row.en) ? 1 : 0
  patched += insertKeyIfMissing(files.uk, "uk", row.k, row.uk) ? 1 : 0
  patched += insertKeyIfMissing(files.ru, "ru", row.k, row.ru) ? 1 : 0

  patched += patchValueOnly(files.en, row.k, row.en) ? 1 : 0
  patched += patchValueOnly(files.uk, row.k, row.uk) ? 1 : 0
  patched += patchValueOnly(files.ru, row.k, row.ru) ? 1 : 0
}

console.log("OK translations patched:", patched)

/**
 * 2) Pricing: убрать хардкод “Тарифы” и везде использовать t(...)
 */
patchFile("app/pricing/page.tsx", (t) => {
  // заголовок
  t = t.replace(
    /<h1([^>]*)>\s*Тарифы\s*<\/h1>/g,
    '<h1$1>{t("Pricing")}</h1>'
  )
  return t
})

/**
 * 3) Home hero: alt не должен быть захардкожен на EN
 */
patchFile("components/home-hero.tsx", (t) => {
  // alt="TurbotaAI AI companion" -> alt={t("TurbotaAI — AI companion")}
  t = t.replace(
    /alt="TurbotaAI AI companion"/g,
    'alt={t("TurbotaAI — AI companion")}'
  )
  return t
})

/**
 * 4) В виджете подпись внизу: “Created by Team”
 *    и плавность открытия (чуть длиннее и мягче)
 */
patchFile("components/assistant-fab.tsx", (t) => {
  // подпись
  t = t.replace(/Powered by TurbotaAI Team/g, 't("Created by TurbotaAI Team")')

  // плавность — делаем более длинный transition, если встречаются базовые классы
  t = t.replace(/duration-150/g, "duration-300")
  t = t.replace(/duration-200/g, "duration-300")
  t = t.replace(/ease-in-out/g, "ease-out")

  return t
})

console.log("DONE final-pack-3 ✅")
