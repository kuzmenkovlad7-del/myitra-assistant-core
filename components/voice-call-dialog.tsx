"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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

type Role = "user" | "assistant"
type Gender = "female" | "male"

type VoiceMessage = {
  id: string
  role: Role
  text: string
  gender?: Gender
}

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

const FALLBACK_AGENT_API = "/api/turbotaai-agent"
const STT_API = "/api/stt?lang=uk"

// ВАЖНО: одинаково на ПК и телефоне
const SILENCE_MS = 2800
const MAX_UTTERANCE_MS = 25000
const REC_TIMESLICE_MS = 250

function pickSupportedMime(): string {
  const MR = (globalThis as any).MediaRecorder as typeof MediaRecorder | undefined
  if (!MR?.isTypeSupported) return ""
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ]
  for (const c of candidates) {
    try {
      if (MR.isTypeSupported(c)) return c
    } catch {}
  }
  return ""
}

function computeRms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]
    sum += v * v
  }
  return Math.sqrt(sum / buf.length)
}

function normalizeText(s: string) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .trim()
}

function stripGreetingAndNoise(text: string, isFirst: boolean) {
  let t = normalizeText(text)
  if (!t) return ""

  // убираем короткие “галлюцинации” на конце/тишине
  const noiseOnly =
    /^(mm+|м+|а+|е+|эм+|uh+|um+|ok+|okay+|дякую+|спасибо+|thank you+|bye+|бай+)\b/i.test(t) &&
    t.length <= 12
  if (noiseOnly) return ""

  // “привіт/вітаю/привет” часто прилетает на коротких чанках — убираем, если это НЕ первая фраза
  if (!isFirst) {
    t = t.replace(/^(привіт|вітаю|привет|hello)\s*[!.,—-]*\s*/i, "")
    t = normalizeText(t)
  }

  // если после чистки пусто — игнор
  if (!t) return ""

  return t
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: VoiceCallDialogProps) {
  const { t } = useLanguage()
  const { user } = useAuth()

  const effectiveEmail = userEmail || (user as any)?.email || undefined

  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const voiceGenderRef = useRef<Gender>("female")

  // audio refs
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const mimeRef = useRef<string>("")

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const srcNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rmsBufRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  const rafRef = useRef<number | null>(null)

  // VAD state
  const noiseFloorRef = useRef(0.003)
  const lastVoiceAtRef = useRef(0)
  const inUttRef = useRef(false)
  const uttStartAtRef = useRef(0)
  const uttStartChunkIdxRef = useRef(0)
  const lastVoiceChunkIdxRef = useRef(0)
  const voiceHighSinceRef = useRef<number | null>(null)

  // recorder chunks
  const chunksRef = useRef<Blob[]>([])

  // STT / TTS gating
  const sttBusyRef = useRef(false)
  const speakingRef = useRef(false)
  const lastSentTextRef = useRef<string>("")
  const lastSentAtRef = useRef<number>(0)

  const statusText = useMemo(() => {
    if (!isCallActive) return t("Waiting… you can start speaking anytime.")
    if (isMicMuted) return t("Microphone muted.")
    if (speakingRef.current) return t("Assistant speaking…")
    return t("Assistant is listening, you can speak.")
  }, [isCallActive, isMicMuted, t])

  useEffect(() => {
    // автоскролл
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  useEffect(() => {
    // если диалог закрыли — стопаем всё
    if (!isOpen) {
      void endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  async function safePlayAudioFromTts(text: string, gender: Gender) {
    const payload = {
      language: "uk-UA",
      gender: gender === "female" ? "FEMALE" : "MALE",
      voice: gender === "female" ? "shimmer" : "onyx",
      textSample: text,
    }

    speakingRef.current = true
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) return

      const ct = (res.headers.get("content-type") || "").toLowerCase()

      if (ct.includes("audio/")) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        await audio.play().catch(() => {})
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
        })
        URL.revokeObjectURL(url)
        return
      }

      // fallback: json {audioUrl|audioBase64}
      const data: any = await res.json().catch(() => null)
      if (data?.audioUrl) {
        const audio = new Audio(data.audioUrl)
        await audio.play().catch(() => {})
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
        })
      } else if (data?.audioBase64) {
        const bin = atob(data.audioBase64)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        const blob = new Blob([arr], { type: "audio/mpeg" })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        await audio.play().catch(() => {})
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
        })
        URL.revokeObjectURL(url)
      }
    } finally {
      // маленький буфер чтобы не ловить хвост озвучки как “привіт”
      await new Promise((r) => setTimeout(r, 180))
      speakingRef.current = false
    }
  }

  async function handleUserText(text: string) {
    const clean = normalizeText(text)
    if (!clean) return

    const now = Date.now()
    if (clean === lastSentTextRef.current && now - lastSentAtRef.current < 2500) {
      return
    }
    lastSentTextRef.current = clean
    lastSentAtRef.current = now

    const userMsg: VoiceMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: clean,
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const endpoint = webhookUrl || TURBOTA_AGENT_WEBHOOK_URL || FALLBACK_AGENT_API

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          language: "uk-UA",
          locale: "uk-UA",
          userEmail: effectiveEmail,
          voiceGender: voiceGenderRef.current,
        }),
      })

      const data: any = await res.json().catch(() => null)

      const replyText =
        normalizeText(
          data?.reply ||
            data?.text ||
            data?.answer ||
            data?.message ||
            data?.assistant ||
            data?.output ||
            "",
        ) || t("Sorry, I didn’t understand. Please repeat.")

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: replyText,
        gender: voiceGenderRef.current,
      }
      setMessages((prev) => [...prev, assistantMsg])

      // озвучка
      await safePlayAudioFromTts(replyText, voiceGenderRef.current)
    } catch (e: any) {
      setNetworkError(e?.message || "Network error")
    }
  }

  async function sendUttToStt(chunks: Blob[], mimeType: string) {
    if (sttBusyRef.current) return
    sttBusyRef.current = true
    try {
      const blob = new Blob(chunks, { type: mimeType || "audio/webm" })
      if (blob.size < 1400) return

      const res = await fetch(STT_API, {
        method: "POST",
        headers: {
          "Content-Type": mimeType || "audio/webm",
          "x-stt-language": "uk",
        },
        body: blob,
      })

      if (!res.ok) return

      const data: any = await res.json().catch(() => null)
      const full = normalizeText(data?.text || "")
      const cleaned = stripGreetingAndNoise(full, messages.length === 0)

      if (!cleaned) return

      await handleUserText(cleaned)
    } catch (e: any) {
      // не падаем
      setNetworkError(e?.message || "STT error")
    } finally {
      sttBusyRef.current = false
    }
  }

  function stopRaf() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function cleanupAudio() {
    stopRaf()

    try {
      recorderRef.current?.stop()
    } catch {}

    recorderRef.current = null

    if (streamRef.current) {
      for (const tr of streamRef.current.getTracks()) {
        try {
          tr.stop()
        } catch {}
      }
    }
    streamRef.current = null

    try {
      srcNodeRef.current?.disconnect()
    } catch {}
    srcNodeRef.current = null

    try {
      analyserRef.current?.disconnect()
    } catch {}
    analyserRef.current = null

    try {
      audioCtxRef.current?.close()
    } catch {}
    audioCtxRef.current = null

    rmsBufRef.current = null

    chunksRef.current = []
    inUttRef.current = false
    uttStartAtRef.current = 0
    uttStartChunkIdxRef.current = 0
    lastVoiceChunkIdxRef.current = 0
    voiceHighSinceRef.current = null
    noiseFloorRef.current = 0.003
    lastVoiceAtRef.current = 0
  }

  async function endCall() {
    setIsCallActive(false)
    setIsConnecting(false)
    setIsMicMuted(false)
    speakingRef.current = false
    sttBusyRef.current = false
    cleanupAudio()
  }

  function toggleMic() {
    setIsMicMuted((prev) => {
      const next = !prev
      const stream = streamRef.current
      if (stream) {
        for (const tr of stream.getAudioTracks()) {
          tr.enabled = !next
        }
      }
      return next
    })
  }

  function startVadLoop() {
    const analyser = analyserRef.current
    const buf = rmsBufRef.current
    if (!analyser || !buf) return

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)

      if (!isCallActive) return
      if (isMicMuted) return

      const rms = computeRms(analyser, buf)

      // обновляем noiseFloor, когда НЕ голос и НЕ говорим TTS
      const nf = noiseFloorRef.current
      const isCurrentlySpeaking = speakingRef.current
      const now = performance.now()

      // динамический порог
      const floor = isCurrentlySpeaking ? nf : (0.97 * nf + 0.03 * rms)
      noiseFloorRef.current = Math.max(0.0008, Math.min(0.03, floor))

      const thr = Math.max(0.0075, noiseFloorRef.current * 3.8)
      const voice = !isCurrentlySpeaking && rms > thr

      // “антидребезг”: голос должен держаться >= 120мс чтобы стартануть
      if (!inUttRef.current) {
        if (voice) {
          if (voiceHighSinceRef.current == null) voiceHighSinceRef.current = now
          if (now - (voiceHighSinceRef.current ?? now) >= 120) {
            inUttRef.current = true
            uttStartAtRef.current = now

            // preroll: захватим чуть раньше
            const pre = 2 // ~0.5s
            const startIdx = Math.max(0, chunksRef.current.length - pre)
            uttStartChunkIdxRef.current = startIdx

            lastVoiceAtRef.current = now
            lastVoiceChunkIdxRef.current = chunksRef.current.length
          }
        } else {
          voiceHighSinceRef.current = null
        }
        return
      }

      // если в utterance — трекаем последнее "есть голос"
      if (voice) {
        lastVoiceAtRef.current = now
        lastVoiceChunkIdxRef.current = chunksRef.current.length
      }

      const sinceVoice = now - lastVoiceAtRef.current
      const sinceStart = now - uttStartAtRef.current

      const shouldEndBySilence = sinceVoice >= SILENCE_MS
      const shouldEndByMax = sinceStart >= MAX_UTTERANCE_MS

      if (shouldEndBySilence || shouldEndByMax) {
        // режем по последнему голосовому чанку (чтобы не слать 2.8с тишины и не ловить галлюцинации)
        const start = uttStartChunkIdxRef.current
        const end = Math.min(
          chunksRef.current.length,
          Math.max(start, lastVoiceChunkIdxRef.current + 2), // небольшой postroll
        )

        const uttChunks = chunksRef.current.slice(start, end)
        const mime = mimeRef.current || "audio/webm"

        // сброс под следующий utterance
        chunksRef.current = []
        inUttRef.current = false
        voiceHighSinceRef.current = null
        uttStartAtRef.current = 0
        uttStartChunkIdxRef.current = 0
        lastVoiceChunkIdxRef.current = 0
        lastVoiceAtRef.current = 0

        void sendUttToStt(uttChunks, mime)
      }
    }

    tick()
  }

  async function startCall(gender: Gender) {
    if (isConnecting) return
    setNetworkError(null)
    setIsConnecting(true)
    voiceGenderRef.current = gender

    try {
      // 1) getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })
      streamRef.current = stream

      // 2) AudioContext + analyser (VAD)
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      const audioCtx = new AC()
      audioCtxRef.current = audioCtx

      const src = audioCtx.createMediaStreamSource(stream)
      srcNodeRef.current = src

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      src.connect(analyser)
      rmsBufRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4)) as Float32Array<ArrayBuffer>

      // 3) MediaRecorder
      const mime = pickSupportedMime()
      mimeRef.current = mime || ""

      const MR = (window as any).MediaRecorder as typeof MediaRecorder | undefined
      if (!MR) {
        throw new Error("MediaRecorder is not supported in this browser")
      }

      const recorder = new MR(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder

      chunksRef.current = []
      inUttRef.current = false
      voiceHighSinceRef.current = null
      noiseFloorRef.current = 0.003
      lastSentTextRef.current = ""
      lastSentAtRef.current = 0

      recorder.ondataavailable = (e: BlobEvent) => {
        if (!e.data || e.data.size === 0) return
        chunksRef.current.push(e.data)
      }

      recorder.onerror = (e: any) => {
        setNetworkError(e?.message || "Recorder error")
      }

      recorder.start(REC_TIMESLICE_MS)

      setIsCallActive(true)
      setIsConnecting(false)

      // старт VAD
      startVadLoop()
    } catch (e: any) {
      setIsConnecting(false)
      setIsCallActive(false)
      cleanupAudio()
      const err = e instanceof Error ? e : new Error(String(e))
      onError?.(err)
      setNetworkError(err.message)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          void endCall()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pb-4 pt-5 text-white">
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
                onClick={() => {
                  void endCall()
                  onClose()
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/15"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pb-2 pt-4">
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
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
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
                      onClick={() => void endCall()}
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
                      className="h-11 flex-1 rounded-full bg-pink-600 px-5 text-xs font-semibold text-white shadow-sm hover:bg-pink-700 sm:max-w-xs"
                    >
                      {isConnecting && voiceGenderRef.current === "female" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          {t("Start with female voice")}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void startCall("male")}
                      disabled={isConnecting}
                      className="h-11 flex-1 rounded-full bg-sky-600 px-5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 sm:max-w-xs"
                    >
                      {isConnecting && voiceGenderRef.current === "male" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Brain className="h-3 w-3" />
                          {t("Start with male voice")}
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
