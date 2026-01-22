import fs from "fs"

function read(p) { return fs.readFileSync(p, "utf8") }
function write(p, t) { fs.writeFileSync(p, t, "utf8"); console.log("OK patched ->", p) }

function patch(p, fn) {
  if (!fs.existsSync(p)) { console.log("SKIP missing ->", p); return }
  const before = read(p)
  const after = fn(before)
  if (after !== before) write(p, after)
  else console.log("OK no changes ->", p)
}

const baseExpr = 'process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"'

// 1) FIX payment/return broken String(...) + safeNewURL definition
patch("app/payment/return/page.tsx", (t) => {
  // remove broken String(input, something)
  t = t.replace(/String\(\s*input\s*,[^)]*\)/g, "String(input)")

  const def =
`function safeNewURL(input: any, base?: string) {
  const fallback = base ?? (${baseExpr})
  try {
    if (input == null || input === "" || input === "null" || input === "undefined") return new URL(fallback)
    return new URL(String(input), fallback)
  } catch {
    return new URL(fallback)
  }
}

`

  if (t.includes("function safeNewURL(")) {
    t = t.replace(/function\s+safeNewURL\([\s\S]*?\n}\n\n?/m, def)
  } else {
    const i = t.indexOf("export")
    t = i !== -1 ? (t.slice(0, i) + def + t.slice(i)) : (def + t)
  }

  return t
})

// 2) assistant-fab: translate Powered by + smoother animation
patch("components/assistant-fab.tsx", (t) => {
  // JSX text node
  t = t.replace(/>\s*Powered by TurbotaAI Team\s*</g, '>{t("Created by TurbotaAI Team")}<')
  // string literal
  t = t.replace(/(["'`])Powered by TurbotaAI Team\1/g, 't("Created by TurbotaAI Team")')

  // smoother animation (light touch)
  t = t.replace(/\bduration-200\b/g, "duration-300")
  t = t.replace(/\bease-in-out\b/g, "ease-out")
  t = t.replace(/\bease-in\b/g, "ease-out")

  return t
})

// 3) subscription client: wrap CardDescription texts with t(...)
patch("app/subscription/subscription-client.tsx", (t) => {
  t = t.replace(
    /<CardDescription>\s*Monthly recurring subscription\s*<\/CardDescription>/g,
    '<CardDescription>{t("Monthly recurring subscription")}</CardDescription>'
  )
  t = t.replace(
    /<CardDescription>\s*Production recurring flow\s*<\/CardDescription>/g,
    '<CardDescription>{t("Production recurring flow")}</CardDescription>'
  )
  return t
})

// 4) pricing: wrap remaining subtitle if still plain
patch("app/pricing/page.tsx", (t) => {
  const raw = "Unlimited access to chat, voice and video sessions. Trial includes 5 questions."
  const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  // as JSX text node
  t = t.replace(new RegExp(`>\\s*${esc}\\s*<`, "g"), `>{t("${raw}")}<`)
  // as standalone line
  t = t.replace(new RegExp(`\\n(\\s*)${esc}\\s*\\n`, "g"), `\n$1{t("${raw}")}\n`)

  return t
})

// 5) footer: translate tagline + rename "Про нас" -> "Про сервіс"
patch("components/footer.tsx", (t) => {
  t = t.replace(/Про нас/g, "Про сервіс")
  // if tagline stored as literal string, convert to t("...") (works if inside component scope)
  t = t.replace(
    /(["'`])Gentle AI support for everyday conversations and emotional care\.\1/g,
    't("Gentle AI support for everyday conversations and emotional care.")'
  )
  // if Powered by exists here too
  t = t.replace(/Powered by TurbotaAI Team/g, '{t("Created by TurbotaAI Team")}')
  return t
})

console.log("DONE fix-pack-2 ✅")
