import fs from "fs"
import path from "path"

const ROOT = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}
function write(rel, s) {
  fs.writeFileSync(path.join(ROOT, rel), s, "utf8")
}

function ensureUseLanguage(rel, s) {
  if (!s.includes(`from "@/lib/i18n/language-context"`)) {
    // вставляем импорт после последнего import
    const lines = s.split("\n")
    let lastImport = -1
    for (let i = 0; i < lines.length; i++) if (lines[i].startsWith("import ")) lastImport = i
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, `import { useLanguage } from "@/lib/i18n/language-context"`)
      s = lines.join("\n")
    }
  }
  // если нет t в деструктуризации useLanguage — добавим const { t } = useLanguage()
  const hasTFromUseLanguage =
    /\bconst\s*\{\s*[^}]*\bt\b[^}]*\}\s*=\s*useLanguage\(\)/.test(s) ||
    /\bconst\s+\w+\s*=\s*useLanguage\(\)/.test(s) // на случай, если уже берут объект
  if (!hasTFromUseLanguage && s.includes("t(")) {
    s = s.replace(
      /export default function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{\s*\n/,
      (m) => m + `  const { t } = useLanguage()\n`
    )
  }
  return s
}

function repAll(s, from, to) {
  if (!s.includes(from)) return s
  return s.split(from).join(to)
}

function patchPricing() {
  const rel = "app/pricing/page.tsx"
  let s = read(rel)

  // ключевые EN-строки с /pricing (по скрину)
  const R = [
    [`Unlimited access to chat, voice and video sessions. Trial includes 5 questions.`, `{t("Unlimited access to chat, voice and video sessions. Trial includes 5 questions.")}`],
    [`Monthly`, `{t("Monthly")}`],
    [`Unlimited chat, voice and video access`, `{t("Unlimited chat, voice and video access")}`],
    [`Unlimited questions`, `{t("Unlimited questions")}`],
    [`Chat, voice and video`, `{t("Chat, voice and video")}`],
    [`History saved in your profile`, `{t("History saved in your profile")}`],
    [`Subscribe`, `{t("Subscribe")}`],
    [`Your profile`, `{t("Your profile")}`],
    [`Check trial balance and history`, `{t("Check trial balance and history")}`],
    [`Status`, `{t("Status")}`],
    [`Guest`, `{t("Guest")}`],
    [`Trial left`, `{t("Trial left")}`],
    [`Open profile`, `{t("Open profile")}`],
    [`Promo code`, `{t("Promo code")}`],
    [`12 months free access by promo code`, `{t("12 months free access by promo code")}`],
    [`Activate promo`, `{t("Activate promo")}`],
    [`Promo activation requires login.`, `{t("Promo activation requires login.")}`],
    [`You can pay without login. For promo activation and history we recommend logging in.`, `{t("You can pay without login. For promo activation and history we recommend logging in.")}`],
  ]

  // аккуратно: заменяем только текстовые узлы/строки, без className и т.п.
  for (const [from, to] of R) {
    // в JSX-тексте: >text<
    s = s.replace(new RegExp(`>(\\s*)${escapeReg(from)}(\\s*)<`, "g"), `>$1${to}$2<`)
    // в строковых литералах: "text"
    s = s.replace(new RegExp(`"${escapeReg(from)}"`, "g"), `"${from}"`) // ключ оставляем как строку
    // в местах где уже было {t("...")} мы не лезем
    if (s.includes(`"${from}"`) && !s.includes(`t("${from}")`)) {
      // пробуем заменить "text" на {t("text")} если это JSX value
      s = s.replace(new RegExp(`:\\s*"${escapeReg(from)}"`, "g"), `: ${to}`)
    }
  }

  // Заголовок страницы: если где-то жёстко "Тарифы" — делаем i18n
  s = s.replace(/>Тарифы</g, `>{t("Pricing")}</`)
  s = s.replace(/>Тарифи</g, `>{t("Pricing")}</`)

  // Добавим t/useLanguage если после замен появился t(
  if (s.includes("t(")) s = ensureUseLanguage(rel, s)

  write(rel, s)
  console.log("OK patched ->", rel)
}

function patchSubscription() {
  const rel = "app/subscription/subscription-client.tsx"
  let s = read(rel)

  const R = [
    [`Subscription`, `{t("Subscription")}`],
    [`Manage`, `{t("Manage")}`],
    [`Getting started`, `{t("Getting started")}`],
    [`Access until`, `{t("Access until")}`],
    [`Not active`, `{t("Not active")}`],
    [`Paid until / Promo until`, `{t("Paid until / Promo until")}`],
    [`Paid: Not active`, `{t("Paid: Not active")}`],
    [`Promo: Not active`, `{t("Promo: Not active")}`],
    [`Auto-renew`, `{t("Auto-renew")}`],
    [`Enabled`, `{t("Enabled")}`],
    [`Order reference: Not set yet`, `{t("Order reference: Not set yet")}`],
    [`Start subscription`, `{t("Start subscription")}`],
    [`Cancel auto-renew`, `{t("Cancel auto-renew")}`],
    [`Enter promo code`, `{t("Enter promo code")}`],
    [`Apply`, `{t("Apply")}`],
    [`Cancel auto-renew does not remove access immediately. It only stops future charges.`, `{t("Cancel auto-renew does not remove access immediately. It only stops future charges.")}`],
    [`Start: first payment creates monthly auto-renew at WayForPay.`, `{t("Start: first payment creates monthly auto-renew at WayForPay.")}`],
    [`Auto-renew: WayForPay charges monthly automatically.`, `{t("Auto-renew: WayForPay charges monthly automatically.")}`],
    [`Cancel: sends SUSPEND to WayForPay and disables future charges.`, `{t("Cancel: sends SUSPEND to WayForPay and disables future charges.")}`],
    [`Resume: sends RESUME to WayForPay and re-enables future charges.`, `{t("Resume: sends RESUME to WayForPay and re-enables future charges.")}`],
    [`Access in the app is controlled by paidUntil and promoUntil in profiles.`, `{t("Access in the app is controlled by paidUntil and promoUntil in profiles.")}`],
  ]

  for (const [from, to] of R) {
    s = s.replace(new RegExp(`>(\\s*)${escapeReg(from)}(\\s*)<`, "g"), `>$1${to}$2<`)
    s = s.replace(new RegExp(`placeholder="${escapeReg(from)}"`, "g"), `placeholder=${to}`)
  }

  if (s.includes("t(")) s = ensureUseLanguage(rel, s)

  write(rel, s)
  console.log("OK patched ->", rel)
}

function patchFooterAndWidget() {
  const files = ["components/footer.tsx", "components/assistant-fab.tsx", "app/contacts/page.tsx", "app/about/page.tsx", "components/home-hero.tsx"]
  for (const rel of files) {
    let s = read(rel)

    // footer/widget EN хвосты из твоего grep
    s = s.replace(/Gentle AI support for everyday conversations and emotional care\./g, `{t("Gentle AI support for everyday conversations and emotional care.")}`)
    s = s.replace(/Powered by TurbotaAI Team/g, `{t("Created by TurbotaAI Team")}`)

    // home-hero alt
    s = s.replace(/alt="TurbotaAI AI companion"/g, `alt={t("TurbotaAI — AI companion")}`)

    // about/contacts явные EN фразы (если есть)
    s = s.replace(/TurbotaAI — AI companion that stays nearby when it feels hard/g, `{t("TurbotaAI — AI companion that stays nearby when it feels hard")}`)
    s = s.replace(/Have questions about how the AI companion works, want to discuss partnership or need help with your account\? Leave a request — we will answer as soon as possible\./g,
      `{t("Have questions about how the AI companion works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.")}`)

    if (s.includes("t(")) s = ensureUseLanguage(rel, s)

    write(rel, s)
    console.log("OK patched ->", rel)
  }
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

patchPricing()
patchSubscription()
patchFooterAndWidget()
console.log("DONE final-i18n-ui-pack ✅")
