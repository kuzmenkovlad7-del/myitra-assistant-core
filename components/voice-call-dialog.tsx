"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Brain, Mic, MicOff, Loader2, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
  webhookUrl?: string
}

type VoiceMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  gender?: "female" | "male"
}

const TURBOTA_AGENT_WEBHOOK_URL = process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""
const FALLBACK_CHAT_API = "/api/chat"

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.text ||
      first.response ||
      first.output ||
      first.message ||
      first.content ||
      first.result ||
      JSON.stringify(first)
    )
      ?.toString()
      .trim()
  }

  if (typeof data === "object") {
    return (
      data.text ||
      data.response ||
      data.output ||
      data.message ||
      data.content ||
      data.result ||
      JSON.stringify(data)
    )
      ?.toString()
      .trim()
  }

  return ""
}

function diffTranscript(prev: string, full: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  full = (full || "").trim()
  if (!full) return ""
  if (!prev) return full

  const prevNorm = normalize(prev)
  const fullNorm = normalize(full)
  if (!prevNorm || !fullNorm) return full

  const prevWords = prevNorm.split(" ")
  const fullWords = fullNorm.split(" ")

  const maxCommon = Math.min(prevWords.length, fullWords.length)
  let common = 0
  while (common < maxCommon && prevWords[common] === fullWords[common]) common++

  if (common === 0) return full

  const rawTokens = full.split(/\s+/)
  if (common >= rawTokens.length) return ""
  return rawTokens.slice(common).join(" ").trim()
}

function getIsDebug(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1"
  } catch {
    return false
  }
}

function pickMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined
  const MR = (window as any).MediaRecorder as typeof MediaRecorder | undefined
  if (!MR || typeof MR.isTypeSupported !== "function") return undefined

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ]

  for (const t of candidates) {
    try {
      if (MR.isTypeSupported(t)) return t
    } catch {
      // ignore
    }
  }
  return undefined
}

export default function VoiceCallDialog({ isOpen, onClose, onError, userEmail, webhookUrl }: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const isDebug = useMemo(() => getIsDebug(), [])
  const dlog = (...args: any[]) => {
    if (!isDebug) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  const effectiveEmail = userEmail || user?.email || "guest@example.com"
  const voiceGenderRef = useRef<"female" | "male">("female")

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isCallActiveRef = useRef(false)

  // media
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const mimeTypeRef = useRef<string | undefined>(undefined)
  const segmentChunksRef = useRef<Blob[]>([])
  const segmentStartTsRef = useRef<number>(0)

  // STT
  const sttBusyRef = useRef(false)
  const queuedBlobRef = useRef<Blob | null>(null)
  const lastTranscriptRef = useRef("")

  // VAD (optional)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const vadOkRef = useRef<boolean>(false)
  const noiseFloorRef = useRef<number>(0)
  const calibrateUntilRef = useRef<number>(0)
  const lastVoiceTsRef = useRef<number>(0)
  const speakingRef = useRef<boolean>(false)
  const finalizePendingRef = useRef<boolean>(false)

  // desktop/mobile tuning
  const SILENCE_MS = 1400
  const MAX_SEGMENT_MS = 22000
  const MIN_SEGMENT_MS = 700
  const TIMESLICE_MS = 1000
  const MIN_BYTES_TO_SEND = 12000

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function computeShortLang(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"
    return lang.startsWith("ru") ? "ru" : lang.startsWith("uk") ? "uk" : "en"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    return (voiceGenderRef.current || "female") === "male" ? "MALE" : "FEMALE"
  }

  async function sendToStt(blob: Blob) {
    if (!isCallActiveRef.current) return

    if (sttBusyRef.current) {
      queuedBlobRef.current = blob
      dlog("[STT] busy -> queued blob size=", blob.size)
      return
    }

    if (blob.size < MIN_BYTES_TO_SEND) {
      dlog("[STT] too small -> skip size=", blob.size, "type=", blob.type)
      return
    }

    sttBusyRef.current = true
    try {
      dlog("[STT] POST /api/stt size=", blob.size, "type=", blob.type || "n/a")
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.success === false) {
        dlog("[STT] error status=", res.status, "raw=", raw?.slice?.(0, 200))
        return
      }

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      dlog("[STT] full=", fullText)
      dlog("[STT] delta=", delta)

      if (!delta) return

      const userMsg: VoiceMessage = { id: `${Date.now()}-user`, role: "user", text: delta }
      setMessages((p) => [...p, userMsg])
      await handleUserText(delta)
    } catch (e: any) {
      dlog("[STT] fatal", e?.message || e)
    } finally {
      sttBusyRef.current = false
      const queued = queuedBlobRef.current
      queuedBlobRef.current = null
      if (queued) {
        void sendToStt(queued)
      }
    }
  }

  function stopAllAudioPlayback() {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      audioRef.current = null
    }
    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {}
    }
  }

  function setTrackEnabled(enabled: boolean) {
    const s = streamRef.current
    if (!s) return
    const track = s.getAudioTracks()?.[0]
    if (!track) return
    try {
      track.enabled = enabled
    } catch {}
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return
    const clean = (text || "").trim()
    if (!clean) return

    const language = computeLangCode()
    const gender = getCurrentGender()

    // пока TTS играет — выключаем трек, чтобы не ловить “эхо” и не ронять VAD
    setIsAiSpeaking(true)
    setTrackEnabled(false)

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, language, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          dlog("[TTS] bad response status=", res.status)
          setIsAiSpeaking(false)
          setTrackEnabled(!isMicMuted)
          return
        }

        stopAllAudioPlayback()

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsAiSpeaking(false)
          audioRef.current = null
          setTrackEnabled(!isMicMuted)
        }
        audio.onerror = () => {
          setIsAiSpeaking(false)
          audioRef.current = null
          setTrackEnabled(!isMicMuted)
        }

        try {
          await audio.play()
        } catch {
          // autoplay restrictions — просто отпускаем микрофон назад
          setIsAiSpeaking(false)
          audioRef.current = null
          setTrackEnabled(!isMicMuted)
        }
      } catch {
        setIsAiSpeaking(false)
        setTrackEnabled(!isMicMuted)
      }
    })()
  }

  async function handleUserText(text: string) {
    const langShort = computeShortLang()
    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langShort,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: computeLangCode(),
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // string
      }

      let answer = extractAnswer(data)
      if (!answer) answer = t("I'm sorry, I couldn't process your message. Please try again.")

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }
      setMessages((p) => [...p, assistantMsg])
      speakText(answer)
    } catch (e: any) {
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
  }

  function cleanupVAD() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    analyserRef.current = null
    vadOkRef.current = false
    speakingRef.current = false
    finalizePendingRef.current = false
    lastVoiceTsRef.current = 0
    noiseFloorRef.current = 0
    calibrateUntilRef.current = 0

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {}
      audioCtxRef.current = null
    }
  }

  function startVAD(stream: MediaStream) {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) {
        dlog("[VAD] no AudioContext")
        vadOkRef.current = false
        return
      }

      const ctx: AudioContext = new Ctx({ latencyHint: "interactive" })
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      source.connect(analyser)

      vadOkRef.current = true
      noiseFloorRef.current = 0
      calibrateUntilRef.current = Date.now() + 800
      lastVoiceTsRef.current = 0
      speakingRef.current = false
      finalizePendingRef.current = false

      const loop = async () => {
        if (!isCallActiveRef.current) return
        const a = analyserRef.current
        const c = audioCtxRef.current
        if (!a || !c) return

        if (c.state === "suspended") {
          try {
            await c.resume()
          } catch {
            // ignore
          }
        }

        const data = new Uint8Array(a.fftSize)
        try {
          a.getByteTimeDomainData(data as unknown as Uint8Array)
        } catch {
          // если DOM типы опять ругнутся — не валим сессию, просто отключаем VAD
          vadOkRef.current = false
        }

        // RMS
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)

        const now = Date.now()
        const calibrating = now < calibrateUntilRef.current

        if (calibrating) {
          // “пол” шума — берем верхнюю границу
          noiseFloorRef.current = Math.max(noiseFloorRef.current, rms)
        }

        const thr = Math.max(noiseFloorRef.current * 3.5, 0.010)

        const voice = rms > thr && !isMicMuted && !isAiSpeaking
        if (voice) {
          lastVoiceTsRef.current = now
          if (!speakingRef.current) {
            speakingRef.current = true
          }
        }

        // финализируем, если была речь и потом тишина
        if (speakingRef.current && !voice) {
          const lastVoice = lastVoiceTsRef.current
          if (lastVoice > 0 && now - lastVoice >= SILENCE_MS) {
            requestFinalize("silence")
          }
        }

        // защита от “очень длинной” речи: режем сегмент по MAX_SEGMENT_MS
        if (segmentStartTsRef.current > 0 && now - segmentStartTsRef.current >= MAX_SEGMENT_MS) {
          requestFinalize("maxlen")
        }

        if (isDebug) {
          dlog("[VAD]", { rms: +rms.toFixed(4), noise: +noiseFloorRef.current.toFixed(4), thr: +thr.toFixed(4), voice })
        }

        rafRef.current = requestAnimationFrame(loop)
      }

      rafRef.current = requestAnimationFrame(loop)
    } catch (e: any) {
      dlog("[VAD] init failed", e?.message || e)
      vadOkRef.current = false
    }
  }

  function stopRecorderOnly() {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state !== "recording") return

    try {
      if (typeof rec.requestData === "function") rec.requestData()
    } catch {}

    // важная мелочь: даем браузеру мгновение “досбросить” буфер
    window.setTimeout(() => {
      try {
        rec.stop()
      } catch {}
    }, 90)
  }

  function requestFinalize(reason: string) {
    if (!isCallActiveRef.current) return
    if (finalizePendingRef.current) return

    const now = Date.now()
    const segMs = segmentStartTsRef.current ? now - segmentStartTsRef.current : 0

    // не режем слишком коротко (иначе blob = 0 / нет смысла)
    if (segMs > 0 && segMs < MIN_SEGMENT_MS) return

    finalizePendingRef.current = true
    dlog("[SEG] finalize requested", reason, "ms=", segMs, "chunks=", segmentChunksRef.current.length)
    stopRecorderOnly()
  }

  function cleanupRecorderAndStream() {
    // recorder
    const rec = recorderRef.current
    recorderRef.current = null
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }

    // stream tracks
    const s = streamRef.current
    streamRef.current = null
    if (s) {
      for (const tr of s.getTracks()) {
        try {
          tr.onended = null
          tr.stop()
        } catch {}
      }
    }
  }

  function startRecorder(stream: MediaStream) {
    const mimeType = mimeTypeRef.current
    const options: MediaRecorderOptions = {}
    if (mimeType) options.mimeType = mimeType

    const rec = new MediaRecorder(stream, options)
    recorderRef.current = rec

    segmentChunksRef.current = []
    segmentStartTsRef.current = Date.now()
    finalizePendingRef.current = false
    speakingRef.current = false
    lastVoiceTsRef.current = 0

    rec.onstart = () => {
      setIsListening(true)
      dlog("[REC] start", mimeType || "(default)")
    }

    rec.ondataavailable = (ev: BlobEvent) => {
      if (!ev.data) return
      if (ev.data.size > 0) {
        segmentChunksRef.current.push(ev.data)
      } else {
        dlog("[REC] zero chunk")
      }
    }

    rec.onerror = (ev: any) => {
      dlog("[REC] error", ev?.name || "", ev?.message || ev)
    }

    rec.onstop = () => {
      setIsListening(false)

      const chunks = segmentChunksRef.current
      const segBlob = new Blob(chunks, { type: mimeType || chunks?.[0]?.type || "application/octet-stream" })
      const segMs = segmentStartTsRef.current ? Date.now() - segmentStartTsRef.current : 0

      dlog("[REC] stop -> blob", { size: segBlob.size, type: segBlob.type, ms: segMs, chunks: chunks.length })

      segmentChunksRef.current = []
      segmentStartTsRef.current = 0
      finalizePendingRef.current = false

      // отправляем сегмент
      if (segBlob.size > 0) {
        void sendToStt(segBlob)
      }

      // если звонок всё ещё активен — запускаем новый сегмент (на том же stream)
      if (isCallActiveRef.current && !isMicMuted) {
        window.setTimeout(() => {
          const s = streamRef.current
          if (!s) return
          try {
            startRecorder(s)
          } catch (e: any) {
            dlog("[REC] restart failed", e?.message || e)
          }
        }, 60)
      }
    }

    rec.start(TIMESLICE_MS)
  }

  async function startCall(gender: "female" | "male") {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setNetworkError(t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."))
      setIsConnecting(false)
      return
    }

    if (typeof window === "undefined" || typeof (window as any).MediaRecorder === "undefined") {
      setNetworkError(t("Microphone recording is not supported in this browser. Please use the latest Chrome/Edge/Safari."))
      setIsConnecting(false)
      return
    }

    try {
      // 1) stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        } as any,
      })

      streamRef.current = stream

      // track ended guard
      const track = stream.getAudioTracks()?.[0]
      if (track) {
        track.onended = () => {
          dlog("[MIC] track ended")
          if (!isCallActiveRef.current) return
          setNetworkError("Microphone stopped unexpectedly. Please reload the page and try again.")
          endCall()
        }
      }

      // 2) mime
      mimeTypeRef.current = pickMimeType()
      dlog("[REC] mime picked =", mimeTypeRef.current || "(default)")

      // 3) VAD (optional)
      cleanupVAD()
      startVAD(stream)

      // 4) recorder
      startRecorder(stream)

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsMicMuted(false)
      setIsAiSpeaking(false)
      setIsConnecting(false)
    } catch (error: any) {
      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."))
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(t("Could not start microphone. Check permissions in the browser and system settings, then try again."))
      }
      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
    }
  }

  function endCall() {
    dlog("[CALL] end")
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    stopAllAudioPlayback()

    cleanupVAD()
    cleanupRecorderAndStream()

    segmentChunksRef.current = []
    segmentStartTsRef.current = 0
    lastTranscriptRef.current = ""
    sttBusyRef.current = false
    queuedBlobRef.current = null
  }

  function toggleMic() {
    const next = !isMicMuted
    setIsMicMuted(next)

    // не стопаем трек, просто выключаем/включаем (это стабильнее на десктопе)
    setTrackEnabled(!next)

    // если включили — и звонок активен — гарантируем, что recorder живой
    if (!next && isCallActiveRef.current) {
      const rec = recorderRef.current
      if (!rec || rec.state === "inactive") {
        const s = streamRef.current
        if (s) {
          try {
            startRecorder(s)
          } catch {}
        }
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endCall()
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isCallActive
    ? t("In crisis situations, please contact local emergency services immediately.")
    : isAiSpeaking
      ? t("Assistant is speaking...")
      : isMicMuted
        ? t("Paused. Turn on microphone to continue.")
        : isListening
          ? t("Listening… you can speak.")
          : t("Waiting... you can start speaking at any moment.")

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          endCall()
          onClose()
        }
      }}
    >
      <DialogContent
        className="max-w-xl border-none bg-transparent p-0 [&>button]:hidden"
      >
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t("Voice session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
                </DialogDescription>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  endCall()
                  onClose()
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"
              >
                ×
              </button>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
                {!isCallActive && messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
                    <p className="mb-2">
                      {t("Choose a voice and start the session. The assistant will listen to you and answer like a real psychologist.")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t("You can switch between female and male voice by ending the call and starting again with a different option.")}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        msg.role === "user"
                          ? "rounded-br-sm bg-slate-900 text-white"
                          : "rounded-bl-sm bg-emerald-50 text-slate-900"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                          <Brain className="h-3 w-3" />
                          {t("AI Psychologist")}
                          {msg.gender && (
                            <span className="ml-1 rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                              {msg.gender === "female" ? t("Female voice") : t("Male voice")}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs md:text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {networkError && (
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">
                    {networkError}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Sparkles className="h-3 w-3" />
                  {statusText}
                </div>

                {isCallActive && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleMic}
                      className={`h-8 w-8 rounded-full border ${
                        isMicMuted
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      onClick={endCall}
                      className="h-8 w-8 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <Phone className="h-4 w-4 rotate-[135deg]" />
                    </Button>
                  </div>
                )}
              </div>

              {!isCallActive && (
                <div className="flex flex-col items-center gap-3 pt-1">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {t("Choose voice for this session")}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                    <Button
                      type="button"
                      onClick={() => void startCall("female")}
                      disabled={isConnecting}
                      className="h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs bg-pink-600 text-white hover:bg-pink-700"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" /> {t("Start with female voice")}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void startCall("male")}
                      disabled={isConnecting}
                      className="h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs bg-sky-50 text-sky-700 hover:bg-sky-100"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Brain className="h-3 w-3" /> {t("Start with male voice")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
