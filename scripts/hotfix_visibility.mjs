import fs from "node:fs"

const path = "app/globals.css"
let s = fs.readFileSync(path, "utf8")

// 1) Удаляем мой прошлый НЕбезопасный блок (он мог ставить opacity:0 на body/контейнер)
const oldTag = "/* Disable soft grid background pattern */"
if (s.includes(oldTag)) {
  const i = s.indexOf(oldTag)
  const j = s.indexOf("}\n", i)
  if (j !== -1) {
    s = s.slice(0, i) + s.slice(j + 2)
  } else {
    s = s.slice(0, i)
  }
}

// 2) Добавляем безопасный override (НЕ скрывает страницу)
const safeTag = "/* Disable soft grid background pattern (safe override) */"
if (!s.includes(safeTag)) {
  s =
    s.trimEnd() +
    "\n\n" +
    safeTag +
    `
body::before,
body::after {
  background-image: none !important;
  opacity: 0 !important;
  content: none !important;
}

.bg-grid,
.grid-pattern,
.bg-grid-pattern {
  background-image: none !important;
}
` +
    "\n"
}

fs.writeFileSync(path, s, "utf8")
console.log("[ok] globals.css fixed (no global opacity:0)")
