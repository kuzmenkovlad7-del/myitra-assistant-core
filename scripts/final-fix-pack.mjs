import fs from "fs"

const FILES = {
  en: "lib/i18n/translations/en.ts",
  uk: "lib/i18n/translations/uk.ts",
  ru: "lib/i18n/translations/ru.ts",
}

const TARGETS = [
  "app/pricing/page.tsx",
  "app/subscription/page.tsx",
  "app/profile/page.tsx",
  "app/payment/return/page.tsx",
  "components/footer.tsx",
  "components/header.tsx",
  "components/ai-chat-dialog.tsx",
  "components/voice-call-dialog.tsx",
]

function exists(p) {
  return fs.existsSync(p)
}
function read(p) {
  return fs.readFileSync(p, "utf8")
}
function writeIfChanged(p, next) {
  const prev = read(p)
  if (prev === next) {
    console.log("OK no changes ->", p)
    return false
  }
  fs.writeFileSync(p, next, "utf8")
  console.log("OK patched ->", p)
  return true
}
function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function escStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function upsertKey(file, key, value) {
  if (!exists(file)) return false
  let t = read(file)
  const before = t

  const keyRe = new RegExp(`("${escRe(key)}"\\s*:\\s*")([^"]*)(")`, "m")
  if (keyRe.test(t)) {
    t = t.replace(keyRe, `$1${escStr(value)}$3`)
  } else {
    // вставляем перед последним закрытием объекта
    // поддержка вариантов: } / } as const / } satisfies ...
    const insertLine = `  "${escStr(key)}": "${escStr(value)}",\n`
    let idx = t.lastIndexOf("\n}")
    if (idx === -1) idx = t.lastIndexOf("}\n")
    if (idx === -1) {
      console.log("WARN: cannot insert key (no object end) ->", file, key)
      return false
    }
    t = t.slice(0, idx + 1) + insertLine + t.slice(idx + 1)
  }

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    return true
  }
  return false
}

// 1) Диалоги: onClose может быть не функцией => делаем безопасно
function fixDialogsOnClose() {
  const dialogFiles = ["components/ai-chat-dialog.tsx", "components/voice-call-dialog.tsx"]
  for (const f of dialogFiles) {
    if (!exists(f)) continue
    let t = read(f)
    const before = t

    // if (!v) onClose();
    t = t.replace(
      /if\s*\(\s*!\s*v\s*\)\s*onClose\s*\(\s*\)\s*;?/g,
      'if (!v) { if (typeof onClose === "function") onClose(); }'
    )

    // !v && onClose()
    t = t.replace(
      /!\s*v\s*&&\s*onClose\s*\(\s*\)/g,
      '!v && typeof onClose === "function" && onClose()'
    )

    if (t !== before) {
      fs.writeFileSync(f, t, "utf8")
      console.log("OK dialog onClose safe ->", f)
    } else {
      console.log("OK dialog onClose already safe ->", f)
    }
  }
}

// 2) Payment return: Invalid URL (new URL(null)) => делаем safeNewURL и подменяем new URL(x) с 1 аргументом
function fixPaymentReturnInvalidURL() {
  const f = "app/payment/return/page.tsx"
  if (!exists(f)) return
  let t = read(f)
  const before = t

  const helper = `
function safeNewURL(input: any, base: string) {
  try {
    if (input == null || input === "" || input === "null" || input === "undefined") return new URL(base)
    return new URL(String(input), base)
  } catch {
    return new URL(base)
  }
}
`.trim() + "\n\n"

  const baseExpr = 'process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"'

  if (!t.includes("function safeNewURL(")) {
    // вставляем после импортов
    const m = t.match(/^(("use client"|\'use client\')\s*;\s*\n)?([\s\S]*?\n)(?=export\s)/m)
    if (m) {
      const head = m[0]
      const rest = t.slice(head.length)
      t = head + "\n" + helper + rest
    } else {
      t = helper + t
    }
  }

  // меняем только new URL(x) с 1 аргументом (без запятой)
  t = t.replace(/new\s+URL\(\s*([^,\)]+?)\s*\)/g, (all, inner) => {
    // не трогаем если это уже safeNewURL
    if (all.includes("safeNewURL")) return all
    return `safeNewURL(${inner}, ${baseExpr})`
  })

  if (t !== before) {
    fs.writeFileSync(f, t, "utf8")
    console.log("OK payment/return safe URL ->", f)
  } else {
    console.log("OK payment/return already safe ->", f)
  }
}

// 3) /pricing часто уходит в STATIC (Guest) => force-dynamic
function forceDynamicPricing() {
  const f = "app/pricing/page.tsx"
  if (!exists(f)) return
  let t = read(f)
  const before = t
  if (t.includes('export const dynamic = "force-dynamic"')) {
    console.log("OK pricing already force-dynamic")
    return
  }
  // вставляем максимально безопасно: после 'use client' если есть, иначе в начало
  if (t.startsWith('"use client"') || t.startsWith("'use client'")) {
    const lines = t.split("\n")
    const i = 1
    lines.splice(i, 0, '', 'export const dynamic = "force-dynamic"', '')
    t = lines.join("\n")
  } else {
    t = 'export const dynamic = "force-dynamic"\n\n' + t
  }
  writeIfChanged(f, t)
}

// 4) Оборачиваем конкретные тексты на Pricing/Subscription/Footer/Header в t("...")
function wrapKnownTextWithT() {
  const pairs = [
    // Pricing subtitle + cards
    ["Unlimited access to chat, voice and video sessions. Trial includes 5 questions.", '{t("Unlimited access to chat, voice and video sessions. Trial includes 5 questions.")}'],
    ["Monthly", '{t("Monthly")}'],
    ["Unlimited chat, voice and video access", '{t("Unlimited chat, voice and video access")}'],
    ["Unlimited questions", '{t("Unlimited questions")}'],
    ["Chat, voice and video", '{t("Chat, voice and video")}'],
    ["History saved in your profile", '{t("History saved in your profile")}'],
    ["Subscribe", '{t("Subscribe")}'],
    ["You can pay without login. For promo activation and history we recommend logging in.", '{t("You can pay without login. For promo activation and history we recommend logging in.")}'],
    ["Your profile", '{t("Your profile")}'],
    ["Check trial balance and history", '{t("Check trial balance and history")}'],
    ["Status", '{t("Status")}'],
    ["Guest", '{t("Guest")}'],
    ["Trial left", '{t("Trial left")}'],
    ["Open profile", '{t("Open profile")}'],
    ["Sign in", '{t("Sign in")}'],
    ["Promo code", '{t("Promo code")}'],
    ["12 months free access by promo code", '{t("12 months free access by promo code")}'],
    ["Activate promo", '{t("Activate promo")}'],
    ["Promo activation requires login.", '{t("Promo activation requires login.")}'],
    ["Enter promo code", '{t("Enter promo code")}'],
    ["Apply", '{t("Apply")}'],

    // Subscription page
    ["Subscription", '{t("Subscription")}'],
    ["Manage", '{t("Manage")}'],
    ["Monthly recurring subscription", '{t("Monthly recurring subscription")}'],
    ["Access until", '{t("Access until")}'],
    ["Not active", '{t("Not active")}'],
    ["Paid until / Promo until", '{t("Paid until / Promo until")}'],
    ["Paid: Not active", '{t("Paid: Not active")}'],
    ["Promo: Not active", '{t("Promo: Not active")}'],
    ["Auto-renew", '{t("Auto-renew")}'],
    ["Enabled", '{t("Enabled")}'],
    ["Disabled", '{t("Disabled")}'],
    ["Order reference: Not set yet", '{t("Order reference: Not set yet")}'],
    ["Start subscription", '{t("Start subscription")}'],
    ["Cancel auto-renew", '{t("Cancel auto-renew")}'],
    ["Resume auto-renew", '{t("Resume auto-renew")}'],
    ["Getting started", '{t("Getting started")}'],
    ["Production recurring flow", '{t("Production recurring flow")}'],
    ["Start: first payment creates monthly auto-renew at WayForPay.", '{t("Start: first payment creates monthly auto-renew at WayForPay.")}'],
    ["Auto-renew: WayForPay charges monthly automatically.", '{t("Auto-renew: WayForPay charges monthly automatically.")}'],
    ["Cancel: sends SUSPEND to WayForPay and disables future charges.", '{t("Cancel: sends SUSPEND to WayForPay and disables future charges.")}'],
    ["Resume: sends RESUME to WayForPay and re-enables future charges.", '{t("Resume: sends RESUME to WayForPay and re-enables future charges.")}'],
    ["Access in the app is controlled by paidUntil and promoUntil in profiles.", '{t("Access in the app is controlled by paidUntil and promoUntil in profiles.")}'],
    ["Cancel auto-renew does not remove access immediately. It only stops future charges.", '{t("Cancel auto-renew does not remove access immediately. It only stops future charges.")}'],

    // Footer + widget labels
    ["Gentle AI support for everyday conversations and emotional care.", '{t("Gentle AI support for everyday conversations and emotional care.")}'],
    ["TurbotaAI is a support tool and does not replace professional help.", '{t("TurbotaAI is a support tool and does not replace professional help.")}'],
    ["Powered by TurbotaAI Team", '{t("Created by TurbotaAI Team")}'],
  ]

  const filesToPatch = [
    "app/pricing/page.tsx",
    "app/subscription/page.tsx",
    "components/footer.tsx",
    "components/header.tsx",
    "components/mobile-nav.tsx",
  ]

  for (const f of filesToPatch) {
    if (!exists(f)) continue
    let t = read(f)
    const before = t

    // 4.1 JSX: >TEXT<  => >{t("TEXT")}<
    for (const [raw, wrapped] of pairs) {
      const re = new RegExp(`>${escRe(raw)}<`, "g")
      t = t.replace(re, `>${wrapped}<`)
    }

    // 4.2 placeholder="TEXT" => placeholder={t("TEXT")}
    for (const [raw] of pairs) {
      const re = new RegExp(`(placeholder=)("|')${escRe(raw)}\\2`, "g")
      t = t.replace(re, `$1{t("${escStr(raw)}")}`)
    }

    // 4.3 value="TEXT" / title="TEXT" / aria-label="TEXT"
    for (const [raw] of pairs) {
      for (const attr of ["title", "aria-label", "value"]) {
        const re = new RegExp(`(${attr}=)("|')${escRe(raw)}\\2`, "g")
        t = t.replace(re, `$1{t("${escStr(raw)}")}`)
      }
    }

    // 4.4 Footer: "Про нас" => "Про сервіс" (как в header)
    t = t.replace(/Про нас/g, "Про сервіс")

    if (t !== before) {
      fs.writeFileSync(f, t, "utf8")
      console.log("OK wrapped texts ->", f)
    } else {
      console.log("OK no wrap needed ->", f)
    }
  }
}

// 5) Добавляем/обновляем переводы для всех новых ключей
function patchTranslations() {
  const PACK = [
    // Header
    { key: "Trial left", en: "Trial left", uk: "Залишилось тріалу", ru: "Осталось триала" },
    { key: "Trial left:", en: "Trial left:", uk: "Залишилось тріалу:", ru: "Осталось триала:" },

    // Pricing
    { key: "Unlimited access to chat, voice and video sessions. Trial includes 5 questions.", en: "Unlimited access to chat, voice and video sessions. Trial includes 5 questions.", uk: "Необмежений доступ до чату, голосу та відео. Тріал включає 5 запитів.", ru: "Безлимитный доступ к чату, голосу и видео. Триал включает 5 запросов." },
    { key: "Monthly", en: "Monthly", uk: "Щомісяця", ru: "Ежемесячно" },
    { key: "Unlimited chat, voice and video access", en: "Unlimited chat, voice and video access", uk: "Необмежений доступ до чату, голосу та відео", ru: "Безлимитный доступ к чату, голосу и видео" },
    { key: "Unlimited questions", en: "Unlimited questions", uk: "Необмежена кількість запитів", ru: "Безлимитное количество запросов" },
    { key: "Chat, voice and video", en: "Chat, voice and video", uk: "Чат, голос і відео", ru: "Чат, голос и видео" },
    { key: "History saved in your profile", en: "History saved in your profile", uk: "Історія зберігається у профілі", ru: "История сохраняется в профиле" },
    { key: "Subscribe", en: "Subscribe", uk: "Підписатися", ru: "Подписаться" },
    { key: "You can pay without login. For promo activation and history we recommend logging in.", en: "You can pay without login. For promo activation and history we recommend logging in.", uk: "Оплата можлива без входу. Для активації промокоду та збереження історії рекомендуємо увійти.", ru: "Оплата возможна без входа. Для активации промокода и сохранения истории рекомендуем войти." },
    { key: "Your profile", en: "Your profile", uk: "Ваш профіль", ru: "Ваш профиль" },
    { key: "Check trial balance and history", en: "Check trial balance and history", uk: "Перевіряйте баланс тріалу та історію", ru: "Проверяйте баланс триала и историю" },
    { key: "Status", en: "Status", uk: "Статус", ru: "Статус" },
    { key: "Guest", en: "Guest", uk: "Гість", ru: "Гость" },
    { key: "Trial left", en: "Trial left", uk: "Залишилось тріалу", ru: "Осталось триала" },
    { key: "Open profile", en: "Open profile", uk: "Відкрити профіль", ru: "Открыть профиль" },
    { key: "Sign in", en: "Sign in", uk: "Увійти", ru: "Войти" },
    { key: "Promo code", en: "Promo code", uk: "Промокод", ru: "Промокод" },
    { key: "12 months free access by promo code", en: "12 months free access by promo code", uk: "12 місяців безкоштовного доступу за промокодом", ru: "12 месяцев бесплатного доступа по промокоду" },
    { key: "Activate promo", en: "Activate promo", uk: "Активувати промо", ru: "Активировать промо" },
    { key: "Promo activation requires login.", en: "Promo activation requires login.", uk: "Активація промокоду потребує входу.", ru: "Активация промокода требует входа." },
    { key: "Enter promo code", en: "Enter promo code", uk: "Введіть промокод", ru: "Введите промокод" },
    { key: "Apply", en: "Apply", uk: "Застосувати", ru: "Применить" },

    // Subscription page
    { key: "Subscription", en: "Subscription", uk: "Підписка", ru: "Подписка" },
    { key: "Manage", en: "Manage", uk: "Керування", ru: "Управление" },
    { key: "Monthly recurring subscription", en: "Monthly recurring subscription", uk: "Щомісячна підписка", ru: "Ежемесячная подписка" },
    { key: "Access until", en: "Access until", uk: "Доступ до", ru: "Доступ до" },
    { key: "Not active", en: "Not active", uk: "Неактивно", ru: "Неактивно" },
    { key: "Paid until / Promo until", en: "Paid until / Promo until", uk: "Оплачено до / Промо до", ru: "Оплачено до / Промо до" },
    { key: "Paid: Not active", en: "Paid: Not active", uk: "Оплата: Неактивно", ru: "Оплата: Неактивно" },
    { key: "Promo: Not active", en: "Promo: Not active", uk: "Промо: Неактивно", ru: "Промо: Неактивно" },
    { key: "Auto-renew", en: "Auto-renew", uk: "Автопродовження", ru: "Автопродление" },
    { key: "Enabled", en: "Enabled", uk: "Увімкнено", ru: "Включено" },
    { key: "Disabled", en: "Disabled", uk: "Вимкнено", ru: "Выключено" },
    { key: "Order reference: Not set yet", en: "Order reference: Not set yet", uk: "Номер замовлення: ще не встановлено", ru: "Номер заказа: ещё не установлен" },
    { key: "Start subscription", en: "Start subscription", uk: "Підключити підписку", ru: "Подключить подписку" },
    { key: "Cancel auto-renew", en: "Cancel auto-renew", uk: "Вимкнути автопродовження", ru: "Отключить автопродление" },
    { key: "Resume auto-renew", en: "Resume auto-renew", uk: "Увімкнути автопродовження", ru: "Включить автопродление" },
    { key: "Getting started", en: "Getting started", uk: "Як це працює", ru: "Как это работает" },
    { key: "Production recurring flow", en: "Production recurring flow", uk: "Автосписання в продакшені", ru: "Автосписание в продакшене" },
    { key: "Start: first payment creates monthly auto-renew at WayForPay.", en: "Start: first payment creates monthly auto-renew at WayForPay.", uk: "Старт: перша оплата створює щомісячне автопродовження у WayForPay.", ru: "Старт: первая оплата создаёт ежемесячное автопродление в WayForPay." },
    { key: "Auto-renew: WayForPay charges monthly automatically.", en: "Auto-renew: WayForPay charges monthly automatically.", uk: "Автопродовження: WayForPay списує щомісяця автоматично.", ru: "Автопродление: WayForPay списывает ежемесячно автоматически." },
    { key: "Cancel: sends SUSPEND to WayForPay and disables future charges.", en: "Cancel: sends SUSPEND to WayForPay and disables future charges.", uk: "Скасування: надсилає SUSPEND у WayForPay і вимикає майбутні списання.", ru: "Отмена: отправляет SUSPEND в WayForPay и отключает будущие списания." },
    { key: "Resume: sends RESUME to WayForPay and re-enables future charges.", en: "Resume: sends RESUME to WayForPay and re-enables future charges.", uk: "Відновлення: надсилає RESUME у WayForPay і знову вмикає списання.", ru: "Возобновление: отправляет RESUME в WayForPay и снова включает списания." },
    { key: "Access in the app is controlled by paidUntil and promoUntil in profiles.", en: "Access in the app is controlled by paidUntil and promoUntil in profiles.", uk: "Доступ у застосунку керується полями paidUntil і promoUntil у профілі.", ru: "Доступ в приложении управляется полями paidUntil и promoUntil в профиле." },
    { key: "Cancel auto-renew does not remove access immediately. It only stops future charges.", en: "Cancel auto-renew does not remove access immediately. It only stops future charges.", uk: "Вимкнення автопродовження не забирає доступ одразу. Воно лише зупиняє майбутні списання.", ru: "Отключение автопродления не забирает доступ сразу. Оно лишь останавливает будущие списания." },

    // Footer / widget
    { key: "Gentle AI support for everyday conversations and emotional care.", en: "Gentle AI support for everyday conversations and emotional care.", uk: "Ніжна AI підтримка для щоденних розмов та емоційної турботи.", ru: "Мягкая AI поддержка для ежедневных разговоров и эмоциональной заботы." },
    { key: "TurbotaAI is a support tool and does not replace professional help.", en: "TurbotaAI is a support tool and does not replace professional help.", uk: "TurbotaAI — це інструмент підтримки і він не замінює професійну допомогу.", ru: "TurbotaAI — это инструмент поддержки и он не заменяет профессиональную помощь." },
    { key: "Created by TurbotaAI Team", en: "Created by TurbotaAI Team", uk: "Створено командою TurbotaAI", ru: "Создано командой TurbotaAI" },
  ]

  let cEN = 0, cUK = 0, cRU = 0
  for (const row of PACK) {
    cEN += upsertKey(FILES.en, row.key, row.en) ? 1 : 0
    cUK += upsertKey(FILES.uk, row.key, row.uk) ? 1 : 0
    cRU += upsertKey(FILES.ru, row.key, row.ru) ? 1 : 0
  }
  console.log("OK translations upserted:", { EN: cEN, UK: cUK, RU: cRU })
}

fixDialogsOnClose()
fixPaymentReturnInvalidURL()
forceDynamicPricing()
wrapKnownTextWithT()
patchTranslations()

console.log("DONE final fix pack ✅")
