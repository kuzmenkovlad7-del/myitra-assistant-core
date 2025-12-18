"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Dev = { deviceId: string; label: string; kind: string }

function pickMime(): string | null {
  const MR: any = typeof MediaRecorder !== "undefined" ? MediaRecorder : null
  if (!MR?.isTypeSupported) return null
  const cands = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ]
  for (const c of cands) {
    try {
      if (MR.isTypeSupported(c)) return c
    } catch {}
  }
  return null
}

export default function MicSimplePage() {
  const [devices, setDevices] = useState<Dev[]>([])
  const [deviceId, setDeviceId] = useState<string>("")
  const [status, setStatus] = useState<string>("idle")
  const [mime, setMime] = useState<string>("")
  const [rms, setRms] = useState<number>(0)
  const [totalBytes, setTotalBytes] = useState<number>(0)
  const [lastChunk, setLastChunk] = useState<number>(0)
  const [chunks, setChunks] = useState<number>(0)
  const [sttResp, setSttResp] = useState<string>("")
  const [logs, setLogs] = useState<string[]>([])

  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const audioElRef = useRef<HTMLAudioElement | null>(null)

  const supportedMime = useMemo(() => pickMime() || "default", [])

  function log(line: string) {
    setLogs((p) => {
      const next = [`[${new Date().toLocaleTimeString()}] ${line}`, ...p]
      return next.slice(0, 60)
    })
    // eslint-disable-next-line no-console
    console.log(line)
  }

  async function refreshDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const mics = list
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || "(no label yet — allow mic first)",
          kind: d.kind,
        }))
      setDevices(mics)
      if (!deviceId && mics[0]?.deviceId) setDeviceId(mics[0].deviceId)
      log(`devices=${mics.length}`)
    } catch (e: any) {
      log(`enumerateDevices error: ${e?.message || e}`)
    }
  }

  function stopAll() {
    setStatus("stopping")

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const rec = recRef.current
    if (rec) {
      try {
        if (rec.state !== "inactive") rec.stop()
      } catch {}
      recRef.current = null
    }

    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      streamRef.current = null
    }

    const a = audioElRef.current
    if (a) {
      try {
        a.pause()
      } catch {}
      try {
        ;(a as any).srcObject = null
      } catch {}
      audioElRef.current = null
    }

    const ctx = ctxRef.current
    if (ctx) {
      try {
        ctx.close()
      } catch {}
      ctxRef.current = null
    }
    analyserRef.current = null

    setStatus("idle")
  }

  async function start() {
    setSttResp("")
    setTotalBytes(0)
    setLastChunk(0)
    setChunks(0)
    chunksRef.current = []
    setStatus("starting")

    try {
      const useExact = deviceId && deviceId !== "default"
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: useExact ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        } as any,
      }

      log("requesting getUserMedia...")
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      const track = stream.getAudioTracks()[0]
      log(`got stream; track=${track?.label || "?"} readyState=${track?.readyState} enabled=${track?.enabled ? 1 : 0}`)
      try {
        log(`track settings: ${JSON.stringify(track.getSettings?.() || {})}`)
      } catch {}

      track.onended = () => log("TRACK onended fired")
      track.onmute = () => log("TRACK onmute fired")
      track.onunmute = () => log("TRACK onunmute fired")

      // keepalive consumer
      try {
        const a = new Audio()
        a.muted = true
        ;(a as any).playsInline = true
        ;(a as any).srcObject = stream
        audioElRef.current = a
        await a.play().catch(() => {})
        log("keepalive: audio.play ok")
      } catch (e: any) {
        log(`keepalive error: ${e?.message || e}`)
      }

      // analyser meter
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
      const ctx: AudioContext = new AC()
      ctxRef.current = ctx
      try {
        await ctx.resume()
      } catch {}
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser
      src.connect(analyser)

      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        setRms(Math.sqrt(sum / buf.length))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      // recorder
      const chosen = pickMime()
      setMime(chosen || "default")
      const opts: MediaRecorderOptions = chosen ? { mimeType: chosen } : {}
      const rec = new MediaRecorder(stream, opts)
      recRef.current = rec

      rec.onstart = () => log(`REC onstart state=${rec.state} mime=${(rec as any).mimeType || chosen || "default"}`)
      rec.onerror = (ev: any) => log(`REC error: ${ev?.name || ""} ${ev?.message || ""}`)
      rec.onstop = () => log("REC onstop")

      rec.ondataavailable = (ev: BlobEvent) => {
        const b = ev.data
        const size = b?.size || 0
        if (size > 0) {
          chunksRef.current.push(b)
          setChunks(chunksRef.current.length)
          setLastChunk(size)
          setTotalBytes((p) => p + size)
        }
      }

      rec.start()
      log("REC start() called")

      // requestData timer (важно)
      timerRef.current = window.setInterval(() => {
        try {
          const r = recRef.current
          if (r && r.state === "recording") r.requestData()
        } catch {}
      }, 1000)

      setStatus("running")
    } catch (e: any) {
      log(`start error: ${e?.name || ""} ${e?.message || e}`)
      setStatus("idle")
    }
  }

  async function sendToStt() {
    try {
      setSttResp("")
      const arr = chunksRef.current
      if (!arr.length) {
        setSttResp("No chunks yet (totalBytes=0)")
        return
      }
      const type = arr[0].type || "audio/webm"
      const blob = new Blob(arr, { type })
      log(`POST /api/stt size=${blob.size} type=${type}`)

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": type },
        body: blob,
      })
      const text = await res.text()
      setSttResp(`status=${res.status}\n\n${text}`)
    } catch (e: any) {
      setSttResp(`sendToStt error: ${e?.message || e}`)
    }
  }

  useEffect(() => {
    refreshDevices()
    return () => stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Mic Simple</h1>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={refreshDevices} style={{ padding: "8px 12px" }}>Refresh devices</button>
        <button onClick={start} disabled={status === "running" || status === "starting"} style={{ padding: "8px 12px" }}>
          Start
        </button>
        <button onClick={stopAll} style={{ padding: "8px 12px" }}>Stop</button>
        <button onClick={sendToStt} style={{ padding: "8px 12px" }}>Send to /api/stt</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div><b>Status:</b> {status}</div>
        <div><b>Supported mime:</b> {supportedMime}</div>
        <div><b>Chosen mime:</b> {mime}</div>
        <div><b>RMS:</b> {rms.toFixed(6)}</div>
        <div><b>Chunks:</b> {chunks}</div>
        <div><b>Last chunk bytes:</b> {lastChunk}</div>
        <div><b>Total bytes:</b> {totalBytes}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <b>Input device:</b>{" "}
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={{ padding: 6, minWidth: 320 }}>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <b>Logs</b>
          <div style={{ marginTop: 6, height: 260, overflow: "auto", border: "1px solid #ddd", padding: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>
            {logs.join("\n")}
          </div>
        </div>

        <div>
          <b>/api/stt response</b>
          <div style={{ marginTop: 6, height: 260, overflow: "auto", border: "1px solid #ddd", padding: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>
            {sttResp || "—"}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 12, color: "#555", fontSize: 12 }}>
        Если RMS всегда 0.000000 и totalBytes=0 — браузер/OS не даёт звук.
        Если totalBytes растёт — микрофон работает, дальше смотрим /api/stt.
      </p>
    </div>
  )
}
