import fs from "fs"

const file = "components/footer.tsx"
let t = fs.readFileSync(file, "utf8")
const before = t

// убрать импорт useTranslations если он добавился
t = t.replace(
  /^\s*import\s*\{\s*useTranslations\s*\}\s*from\s*["'][^"']+["']\s*;?\s*\n/m,
  ""
)

// убрать строку const { t } = useTranslations()
t = t.replace(
  /^\s*const\s*\{\s*t\s*\}\s*=\s*useTranslations\(\)\s*;?\s*\n/m,
  ""
)

if (t !== before) {
  fs.writeFileSync(file, t, "utf8")
  console.log("OK patched ->", file)
} else {
  console.log("OK no changes ->", file)
}
