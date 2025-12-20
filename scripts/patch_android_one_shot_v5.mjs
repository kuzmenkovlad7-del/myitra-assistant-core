import fs from "fs"

const p = "components/voice-call-dialog.tsx"
let s = fs.readFileSync(p, "utf8")

function pickChunksRefName(src) {
  const refs = []
  const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useRef<[^>]*\[\][^>]*>\(\s*\[\]\s*\)/g
  let m
  while ((m = re.exec(src))) refs.push(m[1])

  if (!refs.length) {
    const re2 = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useRef<[^>]*>\(\s*\[\]\s*\)/g
    while ((m = re2.exec(src))) refs.push(m[1])
  }

  if (!refs.length) return null

  const score = (name) => {
    const n = name.toLowerCase()
    let sc = 0
    if (n.includes("chunk")) sc += 100
    if (n.includes("blob")) sc += 60
    if (n.includes("audio")) sc += 20
    if (n.includes("record")) sc += 10
    return sc
  }

  refs.sort((a,b) => score(b)-score(a))
  return refs[0]
}

const chunksRefName = pickChunksRefName(s)
console.log("Detected chunks ref:", chunksRefName || "(none)")

const chunksLenLine = chunksRefName
  ? `        const chunksLen = (${chunksRefName} as any)?.current?.length`
  : `        const chunksLen = null`

// заменить блок ANDROID_ONE_SHOT_V4 целиком на V5
const reBlock = /\/\/ ANDROID_ONE_SHOT_V4[\s\S]*?\}, \[isCallActive, isMicMuted\]\)\n/s
if (!reBlock.test(s)) {
  console.error("PATCH FAILED: не нашёл блок ANDROID_ONE_SHOT_V4 (вставь сначала v4 или пришли файл)")
  process.exit(1)
}

const newBlock = `// ANDROID_ONE_SHOT_V5: server logs + watchdog (Android one-shot). Логи в Vercel через /api/client-log при ?serverLog=1
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
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isMobile = isAndroid || isIOS
    if (!isMobile) return

    let tick = 0
    let prevChunksLen: any = null
    let stale = 0

    const id = window.setInterval(() => {
      try {
        if (!isCallActiveRef.current) return

        const rec: any = mediaRecorderRef.current
        const state = rec?.state || "null"

${chunksLenLine}
        const sentIdx = (sentIdxRef as any)?.current
        const sttBusy = (isSttBusyRef as any)?.current
        const micMuted = (isMicMutedRef as any)?.current

        tick++

        // лог состояния
        if (tick % 3 === 0) {
          __serverLog("mobile_state", { state, chunksLen, prevChunksLen, stale, sentIdx, sttBusy, micMuted })
        }

        // если чанки обнулились, а sentIdx остался большим — сбрасываем
        if (typeof chunksLen === "number" && typeof sentIdx === "number" && sentIdx > chunksLen) {
          try { (sentIdxRef as any).current = 0 } catch {}
          try { (lastTranscriptRef as any).current = "" } catch {}
          __serverLog("sentIdx_reset", { sentIdx, chunksLen })
        }

        // Android: часто "зависает" dataavailable после первого сообщения — чанки не растут
        if (isAndroid && !micMuted && rec && state === "recording" && typeof chunksLen === "number") {
          if (prevChunksLen !== null && chunksLen === prevChunksLen) stale++
          else stale = 0
          prevChunksLen = chunksLen

          // форсим requestData чаще
          try { rec.requestData?.() } catch {}

          // если 3 тика подряд чанки не меняются — hard restart recorder
          if (stale >= 3) {
            __serverLog("chunks_stalled", { state, chunksLen, prevChunksLen, stale })
            stale = 0
            try { (sentIdxRef as any).current = 0 } catch {}
            try { (lastTranscriptRef as any).current = "" } catch {}

            try { rec.stop?.() } catch {}
            window.setTimeout(() => {
              try {
                const r: any = mediaRecorderRef.current
                if (r && r.state === "inactive") {
                  r.start?.(250)
                  __serverLog("rec_hard_restart", { after: r.state })
                }
              } catch {}
            }, 180)
          }
        }

        // если рекордер явно подвис по стейту — оживляем
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
    }, 800)

    return () => window.clearInterval(id)
  }, [isCallActive, isMicMuted])
`

s = s.replace(reBlock, newBlock + "\n")

fs.writeFileSync(p, s, "utf8")
console.log("OK patched:", p)
