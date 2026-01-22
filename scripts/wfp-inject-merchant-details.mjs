import fs from "fs"

function patchFile(file, fn) {
  const before = fs.readFileSync(file, "utf8")
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8")
    console.log("OK patched ->", file)
  } else {
    console.log("OK no changes ->", file)
  }
}

function ensureImport(src, importLine) {
  if (src.includes(importLine)) return src
  // вставим после первых импортов
  const m = src.match(/^(?:import .*?\n)+/m)
  if (!m) return importLine + "\n" + src
  return src.replace(m[0], m[0] + importLine + "\n")
}

function injectIntoContacts(src) {
  const importLine = `import { MerchantDetailsCard } from "@/components/merchant-details"`
  src = ensureImport(src, importLine)

  if (src.includes("<MerchantDetailsCard />")) return src

  // ищем место: вставим перед самым последним закрытием корневого контейнера return(...)
  // безопасно: добавим блок внизу страницы
  const marker = "\n  return ("
  if (!src.includes(marker)) return src

  // вставка: перед финальным закрывающим </div> самого низа — через эвристику
  const insert = `

        {/* WayForPay: company contacts */}
        <div className="mt-8">
          <MerchantDetailsCard />
        </div>
`
  // пробуем вставить перед последним ");"
  const idx = src.lastIndexOf("\n  )")
  if (idx === -1) return src
  return src.slice(0, idx) + insert + src.slice(idx)
}

function injectIntoFooter(src) {
  const importLine = `import { MerchantDetailsMini } from "@/components/merchant-details"`
  src = ensureImport(src, importLine)

  if (src.includes("<MerchantDetailsMini />")) return src

  // вставим мини-блок реквизитов внутрь футера рядом с контактами
  // якорь: ищем секцию с email support@turbotaai.com или заголовок "Зв'яжіться з нами"
  const anchor1 = "support@turbotaai.com"
  const anchor2 = "Зв'яжіться з нами"

  let anchorPos = src.indexOf(anchor1)
  if (anchorPos === -1) anchorPos = src.indexOf(anchor2)
  if (anchorPos === -1) return src

  // вставка: после ближайшего блока контактов (после строки с email)
  const lineEnd = src.indexOf("\n", anchorPos)
  if (lineEnd === -1) return src

  const insert = `

              <div className="mt-4">
                <MerchantDetailsMini />
              </div>
`
  return src.slice(0, lineEnd) + insert + src.slice(lineEnd)
}

patchFile("app/contacts/page.tsx", injectIntoContacts)
patchFile("components/footer.tsx", injectIntoFooter)

console.log("DONE wfp-inject-merchant-details ✅")
