import fs from "fs"

const p = "components/voice-call-dialog.tsx"
let s = fs.readFileSync(p, "utf8")

if (s.includes("ANDROID_ONE_SHOT_V3")) {
  console.log("SKIP: ANDROID_ONE_SHOT_V3 already applied")
  process.exit(0)
}

// 1) Находим начало компонента
const compStart =
  s.search(/export\s+default\s+function\s+VoiceCallDialog\b/) >= 0
    ? s.search(/export\s+default\s+function\s+VoiceCallDialog\b/)
    : s.search(/function\s+VoiceCallDialog\b/)

if (compStart < 0) {
  console.error("PATCH FAILED: не нашёл начало компонента VoiceCallDialog")
  process.exit(1)
}

// 2) Ищем return( компонента после его начала (первый return на верхнем уровне обычно именно UI)
const after = s.slice(compStart)
const reReturn = /\n\s*return\s*\(\s*\n/g
const m = reReturn.exec(after)

if (!m || typeof m.index !== "number") {
  // fallback: последний "  return (" в файле
  const idx2 = s.lastIndexOf("\n  return (")
  if (idx2 < 0) {
    console.error("PATCH FAILED: не нашёл `return (` для вставки")
    process.exit(1)
  }
  reReturn.lastIndex = 0
}

const insertAt =
  m && typeof m.index === "number"
    ? compStart + m.index
    : s.lastIndexOf("\n  return (")

if (insertAt < 0) {
  console.error("PATCH FAILED: не удалось вычислить позицию вставки")
  process.exit(1)
}

const block = `

  // ANDROID_ONE_SHOT_V3: server logs + watchdog (только мобилки). Логи в терминал через /api/client-log при ?serverLog=1
  function __serverLog(event: string, data: any = {}) {
    try {
      if (typeof window === "undefined") return
      const sp = new URLSearchParams(window.location.search)
      if (!sp.has("serverLog")) return
      fetch("/api/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true as any,
        body: JSON.stringify({
          t: Date.now(),
          href: window.location.href,
          ua: navigator.userAgent,
          event,
          data,
        }),
      }).catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (!isCallActive) return

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
    if (!isMobile) return

    let tick = 0
    const id = window.setInterval(() => {
      try {
        if (!isCallActiveRef.current) return

        const rec: any = mediaRecorderRef.current
        const state = rec?.state || "null"

        const chunksLen = (chunksRef as any)?.current?.length
        const sentIdx = (sentIdxRef as any)?.current
        const sttBusy = (isSttBusyRef as any)?.current
        const micMuted = (isMicMutedRef as any)?.current

        tick++

        // периодически шлём состояние в терминал
        if (tick % 3 === 0) {
          __serverLog("mobile_state", { state, chunksLen, sentIdx, sttBusy, micMuted })
        }

        // ключевой фикс: если Android "обнулил" chunks, а sentIdx остался большим — всё залипает на втором сообщении
        if (typeof chunksLen === "number" && typeof sentIdx === "number" && sentIdx > chunksLen) {
          try { (sentIdxRef as any).current = 0 } catch {}
          try { (lastTranscriptRef as any).current = "" } catch {}
          __serverLog("sentIdx_reset", { sentIdx, chunksLen })
        }

        // если запись идёт, но Android иногда не отдаёт чанки — принудительно просим data
        if (!micMuted && rec && state === "recording" && tick % 2 === 0) {
          try { rec.requestData?.() } catch {}
        }

        // если рекордер подвис на paused/inactive — пробуем оживить
        if (!micMuted && rec) {
          if (state === "paused") {
            try { rec.resume() } catch {}
            __serverLog("rec_resume_try", { state })
          } else if (state === "inactive") {
            try { rec.start(250) } catch {}
            try { (sentIdxRef as any).current = 0 } catch {}
            try { (lastTranscriptRef as any).current = "" } catch {}
            __serverLog("rec_restart_try", { state })
          }
        }
      } catch {}
    }, 900)

    return () => window.clearInterval(id)
  }, [isCallActive, isMicMuted])

`

s = s.slice(0, insertAt) + block + s.slice(insertAt)

// 3) Доп. inline-guard рядом с chunksRef (если найдём) — не обязателен, но помогает
const chunksLine = /(const\s+chunks\s*=\s*chunksRef\.current[^\n]*\n)/
if (chunksLine.test(s)) {
  s = s.replace(chunksLine, (m0) => {
    return (
      m0 +
      `      // ANDROID_ONE_SHOT_V3: если chunks обнулились, сбрасываем sentIdx чтобы не залипало на втором сообщении
      if (sentIdxRef.current > (chunks?.length || 0)) {
        try { sentIdxRef.current = 0 } catch {}
        try { lastTranscriptRef.current = "" } catch {}
        try { __serverLog("sentIdx_reset_inline", { chunksLen: chunks?.length || 0 }) } catch {}
      }
`
    )
  })
} else {
  console.log("WARN: не нашёл `const chunks = chunksRef.current` (inline-guard не вставлен). Watchdog всё равно работает.")
}

fs.writeFileSync(p, s, "utf8")
console.log("OK patched:", p)
