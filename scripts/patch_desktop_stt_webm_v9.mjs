import { readFileSync, writeFileSync } from "node:fs"

const p = "components/voice-call-dialog.tsx"
let s = readFileSync(p, "utf8")
const before = s

let nBlob = 0
s = s.replace(
  /const\s+blob\s*=\s*new\s+Blob\(\s*take\s*,\s*\{\s*type:\s*take\[0\]\?\.\s*type\s*\|\|\s*["']audio\/webm["']\s*\}\s*\)\s*;?/g,
  () => {
    nBlob++
    return `const blob = buildSttBlob(chunks, sentIdx, take[0]?.type || "audio/webm");`
  }
)

let nReset = 0
s = s.replace(
  /(\n[ \t]*)audioChunksRef\.current\.length\s*=\s*0\s*;\s*sentIdxRef\.current\s*=\s*1[^\n]*/g,
  (_m, indent) => {
    nReset++
    return (
`${indent}if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
${indent}  // Android: держим header в [0], отправку начинаем после него
${indent}  if (audioChunksRef.current.length > 0) audioChunksRef.current.splice(1)
${indent}  sentIdxRef.current = 1
${indent}} else {
${indent}  // Desktop: не ставим sentIdx=1 при пустом буфере (иначе 2-й webm без header)
${indent}  audioChunksRef.current.length = 0
${indent}  sentIdxRef.current = 0
${indent}}`
    )
  }
)

if (s === before) {
  console.log("PATCH FAILED: файл не изменился")
  process.exit(1)
}

writeFileSync(p, s, "utf8")
console.log("OK patched:", p)
console.log("Replaced blob:", nBlob)
console.log("Replaced sentIdx reset:", nReset)
