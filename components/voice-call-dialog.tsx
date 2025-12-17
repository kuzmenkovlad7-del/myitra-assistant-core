"use client"

import { useEffect, useRef, useState } from "react"
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

type VoiceMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  gender?: "female" | "male"
}

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""
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

function pickMediaMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined
  const MR: any = (window as any).MediaRecorder
  if (!MR || typeof MR.isTypeSupported !== "function") return undefined

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ]

  for (const c of candidates) {
    try {
      if (MR.isTypeSupported(c)) return c
    } catch {
      // ignore
    }
  }
  return undefined
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"
  const voiceGenderRef = useRef<"female" | "male">("female")

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const segmentChunksRef = useRef<Blob[]>([])
  const segmentBytesRef = useRef(0)

  const sttBusyRef = useRef(false)
  const sttQueueRef = useRef<Blob[]>([])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadTimerRef = useRef<number | null>(null)

  const speakingRef = useRef(false)
  const lastVoiceAtRef = useRef(0)
  const noiseFloorRef = useRef(0.004)
  const segmentStartAtRef = useRef(0)

  const finalizeLockRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1"

  function dlog(...args: any[]) {
    if (!debugEnabled) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
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

  function getCurrentGender(): "MALE" | "FEMALE" {
    return voiceGenderRef.current === "male" ? "MALE" : "FEMALE"
  }

  async function ensureAudioGraph(stream: MediaStream) {
    if (typeof window === "undefined") return
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AC()
    }
    const ctx = audioCtxRef.current!
    try {
      if (ctx.state !== "running") await ctx.resume()
    } catch {
      // ignore
    }

    // Создаём граф так, чтобы Analyser гарантированно "тикал" везде:
    // source -> analyser -> gain(0) -> destination
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.2

    const gain = ctx.createGain()
    gain.gain.value = 0

    source.connect(analyser)
    analyser.connect(gain)
    gain.connect(ctx.destination)

    analyserRef.current = analyser
  }

  function startVadLoop() {
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }

    const analyser = analyserRef.current
    if (!analyser) return

    const buf = new Float32Array(analyser.fftSize)

    speakingRef.current = false
    lastVoiceAtRef.current = 0
    noiseFloorRef.current = 0.004
    segmentStartAtRef.current = Date.now()

    vadTimerRef.current = window.setInterval(() => {
      if (!isCallActiveRef.current) return
      if (isMicMutedRef.current) return
      if (isAiSpeakingRef.current) return

      const an = analyserRef.current
      if (!an) return

      // ВАЖНО: cast чтобы TS не ломал билд на typed-array generics
      ;(an as any).getFloatTimeDomainData(buf as any)

      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i]
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)

      // обновляем noise floor, когда "не говорим"
      if (!speakingRef.current) {
        noiseFloorRef.current = noiseFloorRef.current * 0.98 + rms * 0.02
      }

      const thr = Math.max(noiseFloorRef.current * 4.0, 0.01)
      const now = Date.now()
      const voiceNow = rms > thr

      if (debugEnabled) {
        dlog("[VAD]", {
          rms: Number(rms.toFixed(4)),
          noise: Number(noiseFloorRef.current.toFixed(4)),
          thr: Number(thr.toFixed(4)),
          speaking: speakingRef.current,
          rec: mediaRecorderRef.current?.state || "none",
          bytes: segmentBytesRef.current,
        })
      }

      if (voiceNow) {
        lastVoiceAtRef.current = now
        if (!speakingRef.current) {
          speakingRef.current = true
          segmentStartAtRef.current = now
          dlog("[VAD] speech start")
        }
        return
      }

      // если говорили и наступила тишина
      if (speakingRef.current) {
        const silenceMs = now - lastVoiceAtRef.current
        const maxSegMs = now - segmentStartAtRef.current

        // конец фразы: тишина > 900мс
        if (silenceMs > 900) {
          speakingRef.current = false
          dlog("[VAD] speech end -> finalize")
          void finalizeSegment("vad_end")
          return
        }

        // страховка: если сегмент слишком длинный — тоже финализируем
        if (maxSegMs > 15000) {
          speakingRef.current = false
          dlog("[VAD] max segment -> finalize")
          void finalizeSegment("max_len")
          return
        }
      }
    }, 120)
  }

  function stopVadLoop() {
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }
  }

  function stopAudioGraph() {
    stopVadLoop()
    analyserRef.current = null
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx) {
      try {
        ctx.close()
      } catch {
        // ignore
      }
    }
  }

  async function speakText(text: string) {
    if (typeof window === "undefined") return
    const cleanText = (text || "").trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    // останавливаем запись, чтобы не поймать голос ассистента
    isAiSpeakingRef.current = true
    setIsAiSpeaking(true)
    await stopRecorderOnly("tts")

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, language: langCode, gender }),
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.success === false || !data.audioContent) {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        // возвращаем запись
        if (isCallActiveRef.current && !isMicMutedRef.current) {
          await startRecorderOnly()
        }
        return
      }

      const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

      if (audioRef.current) {
        try {
          audioRef.current.pause()
        } catch {}
        audioRef.current = null
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = async () => {
        audioRef.current = null
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        if (isCallActiveRef.current && !isMicMutedRef.current) {
          await startRecorderOnly()
        }
      }

      audio.onerror = async () => {
        audioRef.current = null
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        if (isCallActiveRef.current && !isMicMutedRef.current) {
          await startRecorderOnly()
        }
      }

      try {
        await audio.play()
      } catch {
        audioRef.current = null
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        if (isCallActiveRef.current && !isMicMutedRef.current) {
          await startRecorderOnly()
        }
      }
    } catch {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        await startRecorderOnly()
      }
    }
  }

  async function handleUserText(text: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    dlog("[CHAT] ->", resolvedWebhook)

    const res = await fetch(resolvedWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: text,
        language: langCode,
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
      // keep string
    }

    let answer = extractAnswer(data)
    if (!answer) {
      answer = t("I'm sorry, I couldn't process your message. Please try again.")
    }

    const assistantMsg: VoiceMessage = {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      text: answer,
      gender: voiceGenderRef.current,
    }

    setMessages((prev) => [...prev, assistantMsg])
    await speakText(answer)
  }

  async function sendSttBlob(blob: Blob) {
    const ct = blob.type || "application/octet-stream"

    dlog("[STT] send", { size: blob.size, type: ct })

    const res = await fetch("/api/stt", {
      method: "POST",
      headers: { "Content-Type": ct },
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
      dlog("[STT] error", res.status, raw)
      return
    }

    const text = (data.text || "").toString().trim()
    if (!text) return

    const userMsg: VoiceMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMsg])
    await handleUserText(text)
  }

  async function drainSttQueue() {
    if (sttBusyRef.current) return
    const next = sttQueueRef.current.shift()
    if (!next) return
    sttBusyRef.current = true
    try {
      await sendSttBlob(next)
    } catch (e) {
      // ignore
    } finally {
      sttBusyRef.current = false
      void drainSttQueue()
    }
  }

  function createRecorder(stream: MediaStream) {
    const mimeType = pickMediaMimeType()
    const options: MediaRecorderOptions = {}
    if (mimeType) options.mimeType = mimeType

    const rec = new MediaRecorder(stream, options)

    rec.ondataavailable = (event: BlobEvent) => {
      const b = event.data
      if (b && b.size > 0) {
        segmentChunksRef.current.push(b)
        segmentBytesRef.current += b.size
        dlog("[REC] chunk", b.size, "totalBytes", segmentBytesRef.current)
      } else {
        dlog("[REC] zero chunk")
      }
    }

    rec.onerror = (event: any) => {
      dlog("[REC] error", event)
    }

    return rec
  }

  async function startRecorderOnly() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return
    if (isAiSpeakingRef.current) return

    const stream = mediaStreamRef.current
    if (!stream) return

    // очищаем сегмент
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    speakingRef.current = false
    lastVoiceAtRef.current = 0
    segmentStartAtRef.current = Date.now()

    const rec = createRecorder(stream)
    mediaRecorderRef.current = rec

    try {
      rec.start(1000) // 1s — без микролагов/нулевых чанков как на 350мс
      setIsListening(true)
      dlog("[REC] start", rec.mimeType || "default")
    } catch (e) {
      dlog("[REC] start failed", e)
      setIsListening(false)
    }
  }

  async function stopRecorderOnly(reason: string) {
    const rec = mediaRecorderRef.current
    mediaRecorderRef.current = null

    if (!rec) return

    if (rec.state === "inactive") {
      setIsListening(false)
      segmentChunksRef.current = []
      segmentBytesRef.current = 0
      return
    }

    await new Promise<void>((resolve) => {
      const onStop = () => resolve()
      rec.addEventListener("stop", onStop, { once: true })
      try {
        rec.stop()
      } catch {
        resolve()
      }
    })

    setIsListening(false)
    dlog("[REC] stopped:", reason)

    // при stop сегмент уже не нужен
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
  }

  async function finalizeSegment(reason: string) {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return
    if (isAiSpeakingRef.current) return
    if (finalizeLockRef.current) return

    finalizeLockRef.current = true
    const rec = mediaRecorderRef.current

    // если нечего отправлять — просто выходим
    if (!rec || segmentBytesRef.current < 8000) {
      finalizeLockRef.current = false
      return
    }

    // стопаем recorder, чтобы получить валидный контейнер с заголовком
    await new Promise<void>((resolve) => {
      const onStop = () => resolve()
      rec.addEventListener("stop", onStop, { once: true })
      try {
        rec.stop()
      } catch {
        resolve()
      }
    })

    setIsListening(false)

    const type =
      rec.mimeType ||
      segmentChunksRef.current[0]?.type ||
      "audio/webm"

    const blob =
      segmentChunksRef.current.length > 0
        ? new Blob(segmentChunksRef.current, { type })
        : null

    dlog("[SEG] finalize", reason, { bytes: segmentBytesRef.current, type })

    // очистим сегмент и recorder
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    mediaRecorderRef.current = null

    // отправляем в очередь STT
    if (blob && blob.size >= 8000) {
      sttQueueRef.current.push(blob)
      void drainSttQueue()
    }

    // стартуем новый recorder сразу (если звонок ещё активен)
    if (isCallActiveRef.current && !isMicMutedRef.current && !isAiSpeakingRef.current) {
      await startRecorderOnly()
    }

    finalizeLockRef.current = false
  }

  const startCall = async (gender: "female" | "male") => {
    if (isConnecting) return

    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setNetworkError(
          t(
            "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      if (typeof (window as any).MediaRecorder === "undefined") {
        setNetworkError(
          t(
            "Microphone recording is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      } as any)

      mediaStreamRef.current = stream

      // если трек реально завершился — покажем ошибку
      const track = stream.getAudioTracks()[0]
      if (track) {
        track.onended = () => {
          dlog("[MIC] track ended")
          setNetworkError(t("Microphone stopped unexpectedly. Please reload the page and try again."))
          void endCall()
        }
      }

      isCallActiveRef.current = true
      isMicMutedRef.current = false
      isAiSpeakingRef.current = false

      setIsCallActive(true)
      setIsMicMuted(false)
      setIsAiSpeaking(false)

      await ensureAudioGraph(stream)
      await startRecorderOnly()
      startVadLoop()

      setIsConnecting(false)
    } catch (error: any) {
      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(
          t("No microphone was found on this device. Please check your hardware."),
        )
      } else {
        setNetworkError(
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
    }
  }

  const endCall = async () => {
    if (!isCallActiveRef.current && !mediaStreamRef.current) {
      setIsCallActive(false)
      setIsListening(false)
      setIsMicMuted(false)
      setIsAiSpeaking(false)
      return
    }

    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)

    stopVadLoop()

    // stop recorder
    const rec = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }

    // stop tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
      mediaStreamRef.current = null
    }

    // stop tts
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

    // cleanup
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    sttQueueRef.current = []
    sttBusyRef.current = false
    speakingRef.current = false
    lastVoiceAtRef.current = 0
    finalizeLockRef.current = false

    stopAudioGraph()
  }

  const toggleMic = async () => {
    const next = !isMicMutedRef.current
    isMicMutedRef.current = next
    setIsMicMuted(next)

    if (!isCallActiveRef.current) return

    if (next) {
      // mute: остановить recorder (не трек)
      await stopRecorderOnly("mute")
    } else {
      // unmute: снова стартуем recorder
      await startRecorderOnly()
    }
  }

  useEffect(() => {
    if (!isOpen) {
      void endCall()
      setMessages([])
      setNetworkError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      void endCall()
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
          void endCall()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-xl border-none bg-transparent p-0">
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

              <Button
                type="button"
                size="icon"
                onClick={() => {
                  void endCall()
                  onClose()
                }}
                className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <span className="text-lg leading-none">×</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div
                ref={scrollRef}
                className="max-h-full space-y-3 pr-1 text-xs md:text-sm"
              >
                {!isCallActive && messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">
                      {t("How it works")}
                    </p>
                    <p className="mb-2">
                      {t(
                        "Choose a voice and start the session. The assistant will listen to you and answer like a real psychologist.",
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t(
                        "You can switch between female and male voice by ending the call and starting again with a different option.",
                      )}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
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
                              {msg.gender === "female"
                                ? t("Female voice")
                                : t("Male voice")}
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
                      onClick={() => void toggleMic()}
                      className={`h-8 w-8 rounded-full border ${
                        isMicMuted
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isMicMuted ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
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
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
                        voiceGenderRef.current === "female"
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100"
                      }`}
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
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
                        voiceGenderRef.current === "male"
                          ? "bg-sky-600 text-white hover:bg-sky-700"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
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
