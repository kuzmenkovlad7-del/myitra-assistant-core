import fs from "node:fs"
import path from "node:path"

function loadDotEnv(file) {
  try {
    const p = path.resolve(process.cwd(), file)
    if (!fs.existsSync(p)) return
    const raw = fs.readFileSync(p, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim()
      if (!s || s.startsWith("#")) continue
      const eq = s.indexOf("=")
      if (eq === -1) continue
      const k = s.slice(0, eq).trim()
      let v = s.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

function unescapeJsString(s) {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
}

function escapeForTsString(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"')
}

function extractTStringsFromFile(tsxPath) {
  const src = fs.readFileSync(tsxPath, "utf8")

  // Ловим только t("...") и t('...') (без шаблонных строк)
  const re = /\bt\s*\(\s*("([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')\s*(?:,|\))/g
  const out = new Set()

  let m
  while ((m = re.exec(src))) {
    const raw = m[2] ?? m[3] ?? ""
    const val = unescapeJsString(raw)
    if (val.trim()) out.add(val)
  }
  return [...out]
}

function parseExistingKeys(tsPath) {
  const s = fs.readFileSync(tsPath, "utf8").split(/\r?\n/)
  const KEY = /^\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([A-Za-z_$][\w$]*))\s*:\s*/
  const keys = new Set()
  for (const line of s) {
    const m = KEY.exec(line)
    if (!m) continue
    const k = m[1] ?? m[2] ?? m[3]
    if (!k) continue
    keys.add(unescapeJsString(k))
  }
  return keys
}

async function openaiTranslateBatch(texts, targetLang) {
  // targetLang: "Russian" | "Ukrainian"
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing (set it in .env.local)")

  const model = process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini"

  const prompt = [
    `Translate each item to ${targetLang}.`,
    `Rules:`,
    `- Return ONLY valid JSON object mapping original -> translation.`,
    `- Preserve punctuation, quotes (“ ”), em dashes (—), and numbers.`,
    `- Keep proper names as names; translate roles/context naturally.`,
    `- Do NOT add commentary.`,
    ``,
    `Items:`,
    ...texts.map((t, i) => `${i + 1}. ${t}`),
  ].join("\n")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a precise professional translator." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error("No content from OpenAI")

  let obj
  try {
    obj = JSON.parse(content)
  } catch (e) {
    throw new Error("Failed to parse JSON from OpenAI: " + content.slice(0, 500))
  }
  return obj
}

function patchTranslationsFile(tsPath, additions, forceOverrides = {}) {
  let s = fs.readFileSync(tsPath, "utf8")

  // Находим конец объектного литерала (последнюю "}")
  const lastBrace = s.lastIndexOf("}")
  if (lastBrace === -1) throw new Error(`Cannot find closing brace in ${tsPath}`)

  const existing = parseExistingKeys(tsPath)

  const lines = []
  // overrides (обновляем даже если ключ есть)
  for (const [k, v] of Object.entries(forceOverrides)) {
    additions[k] = v
  }

  const toAdd = []
  for (const [k, v] of Object.entries(additions)) {
    if (forceOverrides[k] !== undefined) {
      toAdd.push([k, v, true])
    } else if (!existing.has(k)) {
      toAdd.push([k, v, false])
    }
  }

  if (toAdd.length === 0) {
    console.log(`[noop] ${tsPath}: nothing to add`)
    return
  }

  lines.push("")
  lines.push("  // ─────────────────────")
  lines.push("  // Client stories – rotating testimonials (auto)")
  lines.push("")

  for (const [k, v, isOverride] of toAdd) {
    const kk = escapeForTsString(k)
    const vv = escapeForTsString(v)
    lines.push(`  "${kk}": "${vv}",${isOverride ? " // override" : ""}`)
  }
  lines.push("")

  // Вставляем перед финальной "}"
  s = s.slice(0, lastBrace) + lines.join("\n") + s.slice(lastBrace)

  fs.writeFileSync(tsPath, s, "utf8")
  console.log(`[write] ${tsPath}: added ${toAdd.length}`)
}

async function main() {
  loadDotEnv(".env.local")

  const pagePath = "app/client-stories/page.tsx"
  const keys = extractTStringsFromFile(pagePath)

  // Берём только то, что реально относится к client stories (фильтр по очевидным маркерам)
  // Но безопаснее — просто добавим ВСЕ строки t() из этой страницы, которых нет в переводах.
  const enPath = "lib/i18n/translations/en.ts"
  const ruPath = "lib/i18n/translations/ru.ts"
  const ukPath = "lib/i18n/translations/uk.ts"

  const existingEn = parseExistingKeys(enPath)
  const missing = keys.filter((k) => !existingEn.has(k))

  if (missing.length === 0) {
    console.log("[ok] No missing keys for en; still ensuring RU/UK have them")
  }

  // EN: value = key
  const enAdd = Object.fromEntries(missing.map((k) => [k, k]))

  // Спец-правка: убираем слово beta из бейджика везде (значение), оставляя ключ как есть
  const force = {
    "Real experiences from beta users": {
      en: "Real experiences from users",
      ru: "Реальный опыт пользователей",
      uk: "Реальний досвід користувачів",
    },
  }

  // RU/UK: переводим только то, чего нет
  const existingRu = parseExistingKeys(ruPath)
  const existingUk = parseExistingKeys(ukPath)

  const ruNeed = keys.filter((k) => !existingRu.has(k))
  const ukNeed = keys.filter((k) => !existingUk.has(k))

  // батчим чтобы не спамить запросами
  async function translateAll(list, lang) {
    const out = {}
    const chunkSize = 25
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize)
      if (chunk.length === 0) continue
      const res = await openaiTranslateBatch(chunk, lang)
      for (const k of chunk) {
        out[k] = res[k] ?? k
      }
    }
    return out
  }

  let ruAdd = {}
  let ukAdd = {}

  if (ruNeed.length) {
    console.log(`[translate] RU: ${ruNeed.length} strings`)
    ruAdd = await translateAll(ruNeed, "Russian")
  } else {
    console.log("[noop] RU: nothing to translate")
  }

  if (ukNeed.length) {
    console.log(`[translate] UK: ${ukNeed.length} strings`)
    ukAdd = await translateAll(ukNeed, "Ukrainian")
  } else {
    console.log("[noop] UK: nothing to translate")
  }

  patchTranslationsFile(enPath, enAdd, { "Real experiences from beta users": force["Real experiences from beta users"].en })
  patchTranslationsFile(ruPath, ruAdd, { "Real experiences from beta users": force["Real experiences from beta users"].ru })
  patchTranslationsFile(ukPath, ukAdd, { "Real experiences from beta users": force["Real experiences from beta users"].uk })

  console.log("[done] i18n patched")
}

main().catch((e) => {
  console.error(e?.stack || String(e))
  process.exit(1)
})
