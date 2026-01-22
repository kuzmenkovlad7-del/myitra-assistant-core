import fs from "fs"

function read(file) {
  return fs.readFileSync(file, "utf8")
}
function write(file, s) {
  fs.writeFileSync(file, s)
}
function exists(file) {
  return fs.existsSync(file)
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Dedupe object literal keys inside:
 *   const xx = {
 *     "k": "v",
 *   } as const
 * Keeps the LAST occurrence of a key.
 */
function dedupeTranslationsObject(file) {
  if (!exists(file)) return { file, ok: false, reason: "missing" }
  const s = read(file)
  const lines = s.split("\n")

  const start = lines.findIndex((l) => l.includes("= {"))
  const end = lines.findIndex((l) => l.includes("} as const"))

  if (start === -1 || end === -1 || end <= start) {
    return { file, ok: false, reason: "object-block-not-found" }
  }

  const before = lines.slice(0, start + 1)
  const block = lines.slice(start + 1, end)
  const after = lines.slice(end)

  const seen = new Set()
  const outRev = []
  let removed = 0

  for (let i = block.length - 1; i >= 0; i--) {
    const line = block[i]
    const m = line.match(/^\s*"([^"]+)"\s*:\s*/)
    if (m) {
      const key = m[1]
      if (seen.has(key)) {
        removed++
        continue
      }
      seen.add(key)
    }
    outRev.push(line)
  }

  const fixed = [...before, ...outRev.reverse(), ...after].join("\n")
  if (fixed !== s) write(file, fixed)
  return { file, ok: fixed !== s, reason: fixed !== s ? `deduped removed=${removed}` : "no-change" }
}

/**
 * Upsert translation keys:
 * - If key exists: replace value
 * - If key missing: insert before "} as const"
 */
function upsertTranslations(file, map) {
  if (!exists(file)) return { file, ok: false, reason: "missing" }
  let s = read(file)
  const before = s

  for (const [k, v] of Object.entries(map)) {
    const keyRe = new RegExp(`(^\\s*)"${escapeRegExp(k)}"\\s*:\\s*"[^"]*",?`, "gm")
    if (keyRe.test(s)) {
      s = s.replace(keyRe, `$1"${k}": "${v}",`)
    } else {
      // insert new key before } as const
      s = s.replace(/\n\}\s*as const/m, `\n  "${k}": "${v}",\n} as const`)
    }
  }

  if (s !== before) write(file, s)
  return { file, ok: s !== before, reason: s !== before ? "patched" : "no-change" }
}

/**
 * Patch merchant-details to use new merchant constants instead of "—"
 */
function patchMerchantDetails(file) {
  if (!exists(file)) return { file, ok: false, reason: "missing" }
  let s = read(file)
  const before = s

  // ensure import from merchant-address contains needed symbols
  const importRe = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["'](@\/lib\/merchant-address|\.{1,2}\/lib\/merchant-address|lib\/merchant-address)["'];?/m
  const m = s.match(importRe)

  const need = [
    "MERCHANT_LEGAL_NAME",
    "MERCHANT_IPN",
    "MERCHANT_PHONE",
    "MERCHANT_EMAIL",
    "MERCHANT_LEGAL_ADDRESS",
    "MERCHANT_ACTUAL_ADDRESS",
  ]

  if (m) {
    const list = m[1].split(",").map((x) => x.trim()).filter(Boolean)
    const set = new Set(list)
    for (const n of need) set.add(n)
    const next = Array.from(set).join(", ")
    s = s.replace(importRe, `import { ${next} } from "${m[2]}"`)
  } else {
    // add import near top (after "use client" if present)
    const ins =
      `import { ${need.join(", ")} } from "@/lib/merchant-address"\n`
    if (s.startsWith('"use client"') || s.startsWith("'use client'")) {
      const idx = s.indexOf("\n")
      s = s.slice(0, idx + 1) + "\n" + ins + s.slice(idx + 1)
    } else {
      s = ins + s
    }
  }

  // Replace "—" fallbacks for known variables (most common patterns)
  const reps = [
    {
      re: /\b(fullName|legalName|merchantLegalName|companyLegalName)\b\s*(\?\?|\|\|)\s*["']—["']/g,
      to: `$1 $2 MERCHANT_LEGAL_NAME`,
    },
    {
      re: /\b(ipn|taxId|inn|merchantTaxId)\b\s*(\?\?|\|\|)\s*["']—["']/g,
      to: `$1 $2 MERCHANT_IPN`,
    },
    {
      re: /\b(phone|tel|merchantPhone)\b\s*(\?\?|\|\|)\s*["']—["']/g,
      to: `$1 $2 MERCHANT_PHONE`,
    },
    {
      re: /\b(email|mail|merchantEmail)\b\s*(\?\?|\|\|)\s*["']—["']/g,
      to: `$1 $2 MERCHANT_EMAIL`,
    },
    // sometimes "-" used
    {
      re: /\b(fullName|legalName|merchantLegalName|companyLegalName)\b\s*(\?\?|\|\|)\s*["']-["']/g,
      to: `$1 $2 MERCHANT_LEGAL_NAME`,
    },
    {
      re: /\b(ipn|taxId|inn|merchantTaxId)\b\s*(\?\?|\|\|)\s*["']-["']/g,
      to: `$1 $2 MERCHANT_IPN`,
    },
    {
      re: /\b(phone|tel|merchantPhone)\b\s*(\?\?|\|\|)\s*["']-["']/g,
      to: `$1 $2 MERCHANT_PHONE`,
    },
    {
      re: /\b(email|mail|merchantEmail)\b\s*(\?\?|\|\|)\s*["']-["']/g,
      to: `$1 $2 MERCHANT_EMAIL`,
    },
  ]

  for (const r of reps) s = s.replace(r.re, r.to)

  if (s !== before) write(file, s)
  return { file, ok: s !== before, reason: s !== before ? "patched" : "no-change" }
}

/**
 * Clean /subscription card "How it works" text (remove internal dev English)
 */
function patchSubscriptionCopy(file) {
  if (!exists(file)) return { file, ok: false, reason: "missing" }
  let s = read(file)
  const before = s

  // Replace the exact internal text lines if present (TSX text nodes)
  const replaces = [
    {
      re: /Start:\s*first payment creates monthly auto-renew at WayForPay\./g,
      to: `{t("Pay once to activate. Subscription renews automatically each month.")}`,
    },
    {
      re: /Auto-renew:\s*WayForPay charges monthly automatically\./g,
      to: `{t("Your subscription renews automatically each month. You can cancel anytime.")}`,
    },
    {
      re: /Cancel:\s*sends SUSPEND to WayForPay and disables future charges\./g,
      to: `{t("Cancel anytime in your profile. Access stays active until the end of the paid period.")}`,
    },
    {
      re: /Resume:\s*sends RESUME to WayForPay and re-enables future charges\./g,
      to: `{t("You can resume later whenever you want — without losing access history.")}`,
    },
    {
      re: /Доступ у застосунку керується полями paidUntil і promoUntil у профілі\./g,
      to: `{t("All payments are processed securely. If you have questions — contact support.")}`,
    },
    {
      re: /Access in application is controlled by fields paidUntil and promoUntil in profile\./g,
      to: `{t("All payments are processed securely. If you have questions — contact support.")}`,
    },
  ]

  for (const r of replaces) s = s.replace(r.re, r.to)

  // also remove "paidUntil / promoUntil" technical mention if exists in any form
  s = s.replace(/paidUntil\s*and\s*promoUntil/g, "subscription status")

  if (s !== before) write(file, s)
  return { file, ok: s !== before, reason: s !== before ? "patched" : "no-change" }
}

/**
 * Remove Dr./therapy wording from video avatars
 */
function patchVideoAvatars(file) {
  if (!exists(file)) return { file, ok: false, reason: "missing" }
  let s = read(file)
  const before = s

  s = s.replace(/name:\s*"Dr\.\s*Alexander"/g, `name: "Alex"`)
  s = s.replace(/name:\s*"Dr\.\s*Maria"/g, `name: "Mia"`)
  s = s.replace(/name:\s*"Dr\.\s*Sophia"/g, `name: "Leo"`)

  s = s.replace(/"Senior specialist specializing in cognitive behavioral therapy with 15\+ years of experience"/g,
    `"Calm AI companion for everyday conversations and support"`)
  s = s.replace(/"Psychotherapist specializing in emotional regulation, trauma recovery, and relationship counseling"/g,
    `"Warm AI companion for supportive conversations"`)

  // Remove any visible "Dr." prefixes in JSX
  s = s.replace(/Dr\.\s*(Alexander|Maria|Sophia)/g, (m, n) => {
    if (n === "Alexander") return "Alex"
    if (n === "Maria") return "Mia"
    if (n === "Sophia") return "Leo"
    return n
  })

  if (s !== before) write(file, s)
  return { file, ok: s !== before, reason: s !== before ? "patched" : "no-change" }
}

/**
 * Make chat + video dialogs same DialogContent size classes as voice dialog
 */
function patchDialogSizes() {
  const voice = "components/voice-call-dialog.tsx"
  const chat = "components/ai-chat-dialog.tsx"
  const video = "components/video-call-dialog.tsx"

  if (!exists(voice)) return { ok: false, reason: "voice-missing" }

  const vs = read(voice)

  // extract className from first DialogContent occurrence
  let cls = null
  const m1 = vs.match(/<DialogContent[^>]*className="([^"]+)"/m)
  if (m1) cls = m1[1]
  if (!cls) {
    const m2 = vs.match(/<DialogContent[^>]*className=\{cn\("([^"]+)"/m)
    if (m2) cls = m2[1]
  }
  if (!cls) return { ok: false, reason: "voice-dialogcontent-class-not-found" }

  function apply(target) {
    if (!exists(target)) return { file: target, ok: false, reason: "missing" }
    let s = read(target)
    const before = s

    // className="..."
    s = s.replace(/(<DialogContent[^>]*className=")([^"]+)(")/m, `$1${cls}$3`)
    // className={cn("...")}
    s = s.replace(/(<DialogContent[^>]*className=\{cn\(")([^"]+)(")/m, `$1${cls}$3`)

    if (s !== before) write(target, s)
    return { file: target, ok: s !== before, reason: s !== before ? "patched" : "no-change" }
  }

  const r1 = apply(chat)
  const r2 = apply(video)
  return { ok: true, voiceClass: cls, results: [r1, r2] }
}

const results = []

// 1) translations: remove "trial" word for ru/uk + fix EN "Trial left"
results.push(upsertTranslations("lib/i18n/translations/en.ts", {
  "Trial left": "Questions left",
  "Trial left:": "Questions left:",
  "Trial": "Free access",
  "Unlimited access to chat, voice and video sessions. Trial includes 5 questions.":
    "Unlimited access to chat, voice and video sessions. Free access includes 5 questions.",
  "Auto-renew in production": "Automatic renewal each month",
  "Pay once to activate. Subscription renews automatically each month.":
    "Pay once to activate. Subscription renews automatically each month.",
  "Your subscription renews automatically each month. You can cancel anytime.":
    "Your subscription renews automatically each month. You can cancel anytime.",
  "Cancel anytime in your profile. Access stays active until the end of the paid period.":
    "Cancel anytime in your profile. Access stays active until the end of the paid period.",
  "You can resume later whenever you want — without losing access history.":
    "You can resume later whenever you want — without losing access history.",
  "All payments are processed securely. If you have questions — contact support.":
    "All payments are processed securely. If you have questions — contact support.",
  "Calm AI companion for everyday conversations and support":
    "Calm AI companion for everyday conversations and support",
  "Warm AI companion for supportive conversations":
    "Warm AI companion for supportive conversations",
}))

results.push(upsertTranslations("lib/i18n/translations/ru.ts", {
  "Trial": "Бесплатно",
  "Unlimited access to chat, voice and video sessions. Trial includes 5 questions.":
    "Безлимитный доступ к чату, голосу и видео. Бесплатно доступно 5 вопросов.",
  "Auto-renew in production": "Автопродление каждый месяц",
  "Pay once to activate. Subscription renews automatically each month.":
    "Оплатите один раз и доступ активируется сразу. Дальше подписка продлевается автоматически каждый месяц.",
  "Your subscription renews automatically each month. You can cancel anytime.":
    "Подписка продлевается автоматически каждый месяц. Вы можете отменить в любой момент.",
  "Cancel anytime in your profile. Access stays active until the end of the paid period.":
    "Отменяйте в профиле в любой момент. Доступ останется активным до конца оплаченного периода.",
  "You can resume later whenever you want — without losing access history.":
    "Можно возобновить позже в любой момент — без потери истории.",
  "All payments are processed securely. If you have questions — contact support.":
    "Все платежи обрабатываются безопасно. Если есть вопросы — напишите в поддержку.",
  "Calm AI companion for everyday conversations and support":
    "Спокойный AI-собеседник для повседневных разговоров и поддержки",
  "Warm AI companion for supportive conversations":
    "Тёплый AI-собеседник для поддерживающих разговоров",
}))

results.push(upsertTranslations("lib/i18n/translations/uk.ts", {
  "Trial": "Безкоштовно",
  "Unlimited access to chat, voice and video sessions. Trial includes 5 questions.":
    "Безлімітний доступ до чату, голосу та відео. Безкоштовно доступно 5 питань.",
  "Auto-renew in production": "Автопоновлення щомісяця",
  "Pay once to activate. Subscription renews automatically each month.":
    "Оплатіть один раз і доступ активується одразу. Далі підписка поновлюється автоматично щомісяця.",
  "Your subscription renews automatically each month. You can cancel anytime.":
    "Підписка поновлюється автоматично щомісяця. Її можна скасувати будь-коли.",
  "Cancel anytime in your profile. Access stays active until the end of the paid period.":
    "Скасовуйте в профілі будь-коли. Доступ збережеться до кінця оплаченого періоду.",
  "You can resume later whenever you want — without losing access history.":
    "Можна відновити пізніше у будь-який момент — без втрати історії.",
  "All payments are processed securely. If you have questions — contact support.":
    "Усі платежі обробляються безпечно. Якщо є питання — напишіть у підтримку.",
  "Calm AI companion for everyday conversations and support":
    "Спокійний AI співрозмовник для щоденних розмов і підтримки",
  "Warm AI companion for supportive conversations":
    "Теплий AI співрозмовник для підтримувальних розмов",
}))

// dedupe just in case (no more Unlimited drama)
results.push(dedupeTranslationsObject("lib/i18n/translations/en.ts"))
results.push(dedupeTranslationsObject("lib/i18n/translations/ru.ts"))
results.push(dedupeTranslationsObject("lib/i18n/translations/uk.ts"))

// 2) merchant details: show full info (not just address)
results.push(patchMerchantDetails("components/merchant-details.tsx"))

// 3) /subscription text: remove internal dev text
results.push(patchSubscriptionCopy("app/subscription/subscription-client.tsx"))
results.push(patchSubscriptionCopy("app/subscription/page.tsx"))

// 4) avatars: remove Dr./therapy words
results.push(patchVideoAvatars("components/video-call-dialog.tsx"))

// 5) chat+video size = voice size
results.push(patchDialogSizes())

console.log("DONE final polish jan22")
for (const r of results) console.log(r)
