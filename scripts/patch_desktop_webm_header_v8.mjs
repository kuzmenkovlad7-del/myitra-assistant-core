import { readFileSync, writeFileSync } from "node:fs"

const p = "components/voice-call-dialog.tsx"
let s = readFileSync(p, "utf8")
const before = s

const helper = `
function buildSttBlob(allChunks: any[], startIdx: number, mimeType: string) {
  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)

  const safeType = String(mimeType || "audio/webm").split(";")[0] || "audio/webm"

  const idx = Math.max(0, Math.min(startIdx || 0, allChunks.length))
  const slice = allChunks.slice(idx)

  // Desktop Chrome: куски после первого иногда без init/header -> OpenAI: "Invalid file format"
  // Решение: для non-Android при idx>0 всегда добавляем самый первый чанк (там контейнерный заголовок)
  if (!isAndroid && idx > 0 && allChunks.length > 0) {
    return new Blob([allChunks[0], ...slice], { type: safeType })
  }
  return new Blob(slice, { type: safeType })
}
`

if (!s.includes("function buildSttBlob(")) {
  const m = s.match(/\n(type|interface)\s+[A-Za-z0-9_]+\s*/)
  if (!m || m.index === undefined) {
    console.log("PATCH FAILED: не нашёл место для вставки helper (type/interface).")
    process.exit(1)
  }
  s = s.slice(0, m.index) + "\n" + helper + "\n" + s.slice(m.index)
}

let n = 0
s = s.replace(
  /new\s+Blob\(\s*([A-Za-z0-9_]+)\.slice\(\s*sentIdxRef\.current\s*\)\s*,\s*\{\s*type:\s*([^}]+)\}\s*\)/g,
  (_m, chunksVar, typeExpr) => {
    n++
    return `buildSttBlob(${chunksVar}, sentIdxRef.current, ${typeExpr})`
  }
)

if (n === 0) {
  console.log("WARN: не нашёл паттерн new Blob(chunks.slice(sentIdxRef.current), {type: ...}).")
  console.log("Нужно будет патчить альтернативный вариант сборки blob — см. подсказку ниже.")
} else {
  console.log("OK replaced blob builders:", n)
}

if (s !== before) {
  writeFileSync(p, s, "utf8")
  console.log("OK patched:", p)
} else {
  console.log("WARN: файл не изменился (возможно helper уже был и паттерн не совпал).")
}
