import { readFileSync, writeFileSync } from "node:fs"

function patchFile(path, fn) {
  const before = readFileSync(path, "utf8")
  const after = fn(before)
  if (after !== before) {
    writeFileSync(path, after, "utf8")
    console.log("OK patched:", path)
    return true
  } else {
    console.log("WARN: no changes:", path)
    return false
  }
}

// 1) чинит склейку "0sentIdxRef..." и любые похожие кейсы
patchFile("components/voice-call-dialog.tsx", (s) => {
  // вставляем ; если после "0" или ")" сразу идёт идентификатор (без пробела/перевода строки)
  // конкретно для случая: length = 0sentIdxRef.current = 0
  s = s.replace(/(\.current\.length\s*=\s*0)(?=[A-Za-z_$])/g, "$1; ")
  // на всякий: если splice(...) тоже может склеиться
  s = s.replace(/(\.current\.splice\([^)]*\))(?=[A-Za-z_$])/g, "$1; ")
  return s
})

// 2) правим сам скрипт v7, чтобы он всегда ставил ;
patchFile("scripts/patch_android_chunks_inplace_v7.mjs", (s) => {
  s = s.replace(
    /return\s+`\$\{ref\}\.current\.length\s*=\s*0`\s*/g,
    'return `${ref}.current.length = 0;`'
  )
  s = s.replace(
    /return\s+`\$\{ref\}\.current\.splice\(0,\s*\(\$\{a\}\)\)`\s*/g,
    'return `${ref}.current.splice(0, (${a}));`'
  )
  return s
})

console.log("DONE")
