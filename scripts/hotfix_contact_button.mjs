import fs from "node:fs"

const path = "components/contact-form.tsx"
let s = fs.readFileSync(path, "utf8")

const re = /<Button([^>]*\btype=['"]submit['"][^>]*)>/m
const m = s.match(re)

if (!m) {
  console.error("[err] submit <Button type='submit'> not found in contact-form.tsx")
  process.exit(1)
}

let tag = m[0]

// если уже есть violet/black — не трогаем
if (tag.includes("bg-violet-") || tag.includes("bg-black")) {
  console.log("[noop] submit button already styled")
  process.exit(0)
}

// 1) className="..."
if (tag.match(/className=(['"])[^'"]*\1/)) {
  tag = tag.replace(/className=(['"])([^'"]*)\1/, (all, q, v) => {
    if (v.includes("bg-violet-") || v.includes("bg-black")) return all
    return `className=${q}${v} bg-violet-600 hover:bg-violet-700${q}`
  })
}
// 2) className={'...'}
else if (tag.match(/className=\{(['"])[^'"]*\1\}/)) {
  tag = tag.replace(/className=\{(['"])([^'"]*)\1\}/, (all, q, v) => {
    if (v.includes("bg-violet-") || v.includes("bg-black")) return all
    return `className={${q}${v} bg-violet-600 hover:bg-violet-700${q}}`
  })
}
// 3) className={cn(...)}
else if (tag.includes("className={cn(")) {
  tag = tag.replace(/className=\{cn\(([\s\S]*?)\)\}/, (all, inner) => {
    if (inner.includes("bg-violet-") || inner.includes("bg-black")) return all
    return `className={cn(${inner}, "bg-violet-600 hover:bg-violet-700")}`
  })
}
// 4) className нет — добавляем
else {
  tag = tag.replace("<Button", '<Button className="bg-violet-600 hover:bg-violet-700"')
}

s = s.replace(re, tag)
fs.writeFileSync(path, s, "utf8")
console.log("[ok] contact submit button set to violet")
