import { readFileSync, writeFileSync } from "node:fs"

const p = "components/voice-call-dialog.tsx"
let s = readFileSync(p, "utf8")
const before = s

// 1) Убираем rec.pause() (именно у MediaRecorder)
s = s.replace(
  /\n(\s*)try\s*\{\s*\n\1\s*rec\.pause\(\)\s*\n\1\s*\}\s*catch\s*\{\s*\}\s*/g,
  "\n$1// Android: не паузим MediaRecorder во время TTS (ломает 2-е сообщение)\n"
)

// 2) Убираем rec.resume()
s = s.replace(
  /\n(\s*)try\s*\{\s*\n\1\s*rec\.resume\(\)\s*\n\1\s*\}\s*catch\s*\{\s*\}\s*/g,
  "\n$1// Android: не резюмим MediaRecorder (watchdog/рестарт держит поток)\n"
)

// 3) На всякий: если есть однострочные варианты
s = s.replace(/rec\.pause\(\)\s*;?/g, "/* rec.pause() disabled on Android */")
s = s.replace(/rec\.resume\(\)\s*;?/g, "/* rec.resume() disabled on Android */")

if (s === before) {
  console.log("WARN: ничего не поменялось — не нашёл rec.pause/rec.resume паттерны.")
} else {
  writeFileSync(p, s, "utf8")
  console.log("OK patched:", p)
}
