import fs from "fs"

const files = [
  "app/pricing/page.tsx",
  "app/subscription/subscription-client.tsx",
  "components/assistant-fab.tsx",
]

function ensureUseClient(text) {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'")) return text

  // добавляем только если есть хуки или useLanguage
  const needsClient =
    /\buse(Language|State|Effect|Memo|Callback|Ref)\b/.test(text) ||
    /\buseLanguage\s*\(/.test(text) ||
    /\buseTranslations\s*\(/.test(text)

  if (!needsClient) return text

  return `"use client"\n\n${text}`
}

function patchOne(file) {
  let t = fs.readFileSync(file, "utf8")
  const before = t

  // 1) import { useTranslations } -> useLanguage
  // a) если import только useTranslations
  t = t.replace(
    /import\s*\{\s*useTranslations\s*\}\s*from\s*["']@\/lib\/i18n\/language-context["']\s*;?/g,
    'import { useLanguage } from "@/lib/i18n/language-context"'
  )

  // b) если импорт был смешанный { ..., useTranslations, ... }
  t = t.replace(
    /import\s*\{\s*([^}]*?)\buseTranslations\b([^}]*?)\}\s*from\s*["']@\/lib\/i18n\/language-context["']\s*;?/g,
    (_m, a, b) => {
      const inside = `${a} useLanguage ${b}`.replace(/,+/g, ",")
      // чистим пробелы вокруг запятых
      const normalized = inside
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .join(", ")
      return `import { ${normalized} } from "@/lib/i18n/language-context"`
    }
  )

  // 2) useTranslations() -> useLanguage()
  t = t.replace(/\buseTranslations\s*\(\s*\)/g, "useLanguage()")

  // 3) если где-то было const { t } = useTranslations() — уже заменилось на useLanguage()
  // 4) если вдруг импорт useLanguage уже был и стал дублем — удалим один дубль аккуратно
  // (оставляем первый, второй убираем)
  const lines = t.split("\n")
  const seen = new Set()
  const out = []
  for (const line of lines) {
    const key = line.trim()
    if (key.startsWith('import {') && key.includes('from "@/lib/i18n/language-context"')) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(line)
  }
  t = out.join("\n")

  // 5) ensure "use client" если используется хук
  t = ensureUseClient(t)

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", file)
  } else {
    console.log("OK no changes ->", file)
  }
}

for (const f of files) patchOne(f)

console.log("DONE fix-useTranslations-to-useLanguage ✅")
