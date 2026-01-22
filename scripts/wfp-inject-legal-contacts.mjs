import fs from "fs"

const file = "app/contacts/page.tsx"
let t = fs.readFileSync(file, "utf8")

// импорт
const importLine = `import { MerchantDetailsCard } from "@/components/merchant-details"`
if (!t.includes(importLine)) {
  const m = t.match(/^(?:import .*?\n)+/m)
  if (m) t = t.replace(m[0], m[0] + importLine + "\n")
  else t = importLine + "\n" + t
}

// вставка перед </main> (самое безопасное место)
if (!t.includes("<MerchantDetailsCard />")) {
  const block = `
        {/* WayForPay: company contact details */}
        <div className="mt-10">
          <MerchantDetailsCard />
        </div>
`

  if (t.includes("</main>")) {
    t = t.replace("</main>", block + "\n      </main>")
  } else if (t.includes("</AutoTranslate>")) {
    t = t.replace("</AutoTranslate>", block + "\n    </AutoTranslate>")
  }
}

fs.writeFileSync(file, t, "utf8")
console.log("OK patched ->", file)
