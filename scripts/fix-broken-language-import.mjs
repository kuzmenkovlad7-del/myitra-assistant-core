import fs from "fs"

const files = [
  "app/pricing/page.tsx",
  "app/subscription/subscription-client.tsx",
  "components/assistant-fab.tsx",
]

function patch(file) {
  let t = fs.readFileSync(file, "utf8")
  const before = t

  // 1) Разлепляем "import ... language-context"type ... -> "import ... language-context";\n\ntype ...
  t = t.replace(
    /(import\s*\{[^}]*\}\s*from\s*["']@\/lib\/i18n\/language-context["'])\s*type\b/g,
    "$1;\n\ntype"
  )

  // 2) На всякий — если осталась форма ...language-context"type без захвата выше
  t = t.replace(
    /from\s*["']@\/lib\/i18n\/language-context["']\s*type\b/g,
    'from "@/lib/i18n/language-context";\n\ntype'
  )

  // 3) Гарантируем ; на строке импорта language-context (если его нет)
  t = t.replace(
    /^(import\s*\{[^}]*\}\s*from\s*["']@\/lib\/i18n\/language-context["'])(?!;)\s*$/gm,
    "$1;"
  )

  if (t !== before) {
    fs.writeFileSync(file, t, "utf8")
    console.log("OK patched ->", file)
  } else {
    console.log("OK no changes ->", file)
  }
}

for (const f of files) patch(f)

console.log("DONE fix-broken-language-import ✅")
