import fs from "fs"

function exists(p) { return fs.existsSync(p) }
function read(p) { return fs.readFileSync(p, "utf8") }
function write(p, t) { fs.writeFileSync(p, t, "utf8"); console.log("OK patched ->", p) }

const hookFile =
  exists("lib/i18n/use-translations.ts") || exists("lib/i18n/use-translations.tsx")
    ? "@/lib/i18n/use-translations"
    : "@/lib/i18n/language-context"

function ensureUseClient(t) {
  if (/^\s*['"]use client['"]\s*;?/.test(t)) return t
  return `'use client'\n\n` + t
}

function ensureImportUseTranslations(t) {
  // already imported
  if (t.includes("useTranslations")) return t

  const importLine = `import { useTranslations } from "${hookFile}"\n`

  // insert after last import line
  const lines = t.split("\n")
  let lastImport = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s.+from\s.+;?\s*$/.test(lines[i])) lastImport = i
  }

  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine.trimEnd())
    return lines.join("\n")
  }

  // no imports - insert at top after "use client" if exists
  const m = t.match(/^\s*['"]use client['"]\s*;?\s*\n+/)
  if (m) {
    const head = m[0]
    return head + importLine + t.slice(head.length)
  }
  return importLine + t
}

function hasTDeclared(t) {
  return (
    /const\s+\{\s*t\s*\}\s*=\s*useTranslations\(\)/.test(t) ||
    /const\s+t\s*=\s*useTranslations\(\)/.test(t) ||
    /\bt\s*=\s*useTranslations\(\)/.test(t)
  )
}

function injectTIntoDefaultExportFunction(t) {
  if (hasTDeclared(t)) return t

  // export default function X(...) {  -> add hook after open brace
  t = t.replace(
    /(export\s+default\s+function\s+[A-Za-z0-9_]*\s*\([^)]*\)\s*\{\s*\n)/,
    `$1  const { t } = useTranslations()\n`
  )

  // export default function(...) {  (no name)
  t = t.replace(
    /(export\s+default\s+function\s*\([^)]*\)\s*\{\s*\n)/,
    `$1  const { t } = useTranslations()\n`
  )

  // if still not inserted, try first function component
  if (!hasTDeclared(t)) {
    t = t.replace(
      /(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{\s*\n)/,
      `$1  const { t } = useTranslations()\n`
    )
  }

  return t
}

function patchFile(path) {
  if (!exists(path)) return console.log("SKIP missing ->", path)
  let t = read(path)
  const before = t

  if (t.includes("t(") && !hasTDeclared(t)) {
    t = ensureUseClient(t)
    t = ensureImportUseTranslations(t)
    t = injectTIntoDefaultExportFunction(t)
  }

  if (t !== before) write(path, t)
  else console.log("OK no changes ->", path)
}

const targets = [
  "app/pricing/page.tsx",
  "app/subscription/subscription-client.tsx",
  "components/assistant-fab.tsx",
  "components/footer.tsx",
]

for (const f of targets) patchFile(f)

console.log("DONE fix-missing-t-hooks ✅")
