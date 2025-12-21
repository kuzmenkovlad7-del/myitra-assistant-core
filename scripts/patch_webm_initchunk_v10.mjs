import { readFileSync, writeFileSync } from "node:fs"

const p = "components/voice-call-dialog.tsx"
let s = readFileSync(p, "utf8")
const before = s

let changed = 0

// 1) webmInitChunkRef рядом с audioChunksRef
if (!s.includes("webmInitChunkRef")) {
  const re = /(const\s+audioChunksRef\s*=\s*useRef<[^>]*>\(\s*\[\s*\]\s*\)\s*;?)/m
  if (re.test(s)) {
    s = s.replace(re, `$1\n  const webmInitChunkRef = useRef<Blob | null>(null)`)
    changed++
  } else {
    console.log("WARN: не нашёл объявление audioChunksRef — добавь webmInitChunkRef вручную рядом с ним.")
  }
}

// 2) Ловим init-чанк (первый non-empty blob от MediaRecorder)
if (!s.includes("webmInitChunkRef.current = b")) {
  const rePush = /\n(\s*)audioChunksRef\.current\.push\(b\)\s*;?/m
  if (rePush.test(s)) {
    s = s.replace(
      rePush,
      `\n$1if (!webmInitChunkRef.current && b && b.size > 0) webmInitChunkRef.current = b\n$1audioChunksRef.current.push(b)`
    )
    changed++
  } else {
    console.log("WARN: не нашёл audioChunksRef.current.push(b) — проверь место, где пушатся чанки.")
  }
}

// 3) Исправляем сборку blob для STT + guard от tiny blob
const oldBlobLine = `const blob = new Blob(take, { type: take[0]?.type || "audio/webm" })`
if (s.includes(oldBlobLine)) {
  s = s.replace(
    oldBlobLine,
`const init = webmInitChunkRef.current
const needInit = !!init && take.length > 0 && take[0] !== init
const payload = needInit ? [init!, ...take] : take
const blob = new Blob(payload, { type: (payload[0] as any)?.type || "audio/webm" })
if (blob.size < 2000) {
  log("[STT] skip tiny blob", { size: blob.size, take: take.length })
  return
}`
  )
  changed++
} else {
  console.log("WARN: не нашёл точную строку new Blob(take, ...) — найди место где создаётся blob из take и вставь init/guard вручную.")
}

if (s === before) {
  console.log("WARN: ничего не изменилось.")
} else {
  writeFileSync(p, s, "utf8")
  console.log("OK patched:", p, "changes:", changed)
}
