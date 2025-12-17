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

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  return /iPad|iPhone|iPod/.test(ua)
}

function pickRecorderMimeType(): { mimeType?: string; fallbackType: string } {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return { mimeType: undefined, fallbackType: "audio/webm" }
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) {
        return { mimeType: c, fallbackType: c.split(";")[0] }
      }
    } catch {
      // ignore
    }
  }
  return { mimeType: undefined, fallbackType: "audio/webm" }
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

  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("debug") === "1"
  }, [])

  const dlog = (...args: any[]) => {
    if (!debugEnabled) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const [selectedGender, setSelectedGender] = useState<"female" | "male">(
    "female",
  )
  const voiceGenderRef = useRef<"female" | "male">("female")

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Engine state
  const [engine, setEngine] = useState<"recorder" | "speech">("recorder")
  const engineRef = useRef<"recorder" | "speech">("recorder")

  // MediaRecorder path
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bytesRef = useRef(0)
  const zeroBytesTimerRef = useRef<number | null>(null)

  // WebAudio VAD (used only when recorder engine is alive)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gain0Ref = useRef<GainNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const floatBufRef = useRef<Float32Array | null>(null)

  const noiseFloorRef = useRef(0.004)
  const aboveAtRef = useRef<number>(0)
  const speakingRef = useRef(false)
  const hadSpeechRef = useRef(false)
  const segStartedAtRef = useRef<number>(0)
  const lastVoiceAtRef = useRef<number>(0)
  const lastVadLogAtRef = useRef<number>(0)
  const finalizeInFlightRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  // SpeechRecognition fallback
  const speechRecRef = useRef<any>(null)
  const speechRestartTimerRef = useRef<number | null>(null)

  // autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, networkError])

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

  function safeClearTimer(ref: React.MutableRefObject<number | null>) {
    if (ref.current != null) {
      window.clearTimeout(ref.current)
      ref.current = null
    }
  }

  function safeStopRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function stopSpeechRecognition() {
    safeClearTimer(speechRestartTimerRef)
    const sr = speechRecRef.current
    speechRecRef.current = null
    if (sr) {
      try {
        sr.onresult = null
        sr.onerror = null
        sr.onend = null
      } catch {}
      try {
        sr.stop()
      } catch {}
      try {
        sr.abort?.()
      } catch {}
    }
  }

  function closeAudioContext() {
    try {
      safeStopRaf()
      analyserRef.current = null
      gain0Ref.current = null
      floatBufRef.current = null
      if (audioCtxRef.current) {
        const ctx = audioCtxRef.current
        audioCtxRef.current = null
        try {
          ctx.close()
        } catch {}
      }
    } catch {}
  }

  function stopRecorderOnly() {
    const rec = recorderRef.current
    recorderRef.current = null
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
  }

  function stopTracks() {
    const s = streamRef.current
    streamRef.current = null
    if (!s) return
    try {
      s.getTracks().forEach((tr) => {
        try {
          tr.onended = null
        } catch {}
        try {
          tr.stop()
        } catch {}
      })
    } catch {}
  }

  function cleanupAll() {
    finalizeInFlightRef.current = false
    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsConnecting(false)

    safeClearTimer(zeroBytesTimerRef)
    stopSpeechRecognition()

    try {
      stopRecorderOnly()
    } catch {}
    try {
      closeAudioContext()
    } catch {}
    try {
      stopTracks()
    } catch {}

    chunksRef.current = []
    bytesRef.current = 0

    speakingRef.current = false
    hadSpeechRef.current = false
    aboveAtRef.current = 0
    segStartedAtRef.current = 0
    lastVoiceAtRef.current = 0
  }

  async function sendToStt(blob: Blob) {
    if (!isCallActiveRef.current) return
    if (!blob || blob.size < 7000) return

    const ct = (blob.type || "audio/webm").toLowerCase()
    dlog("[STT] send", { size: blob.size, type: ct })

    try {
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
        dlog("[STT] bad response", res.status, raw)
        return
      }

      const text = (data.text || "").toString().trim()
      dlog("[STT] text", text)

      if (!text) return

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }
      setMessages((prev) => [...prev, userMsg])

      await handleUserText(text)
    } catch (e: any) {
      dlog("[STT] error", e?.message || e)
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

    dlog("[CHAT] send", {
      to: resolvedWebhook,
      lang: langCode,
      gender: voiceGenderRef.current,
    })

    try {
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
        // string
      }

      let answer = extractAnswer(data)
      if (!answer) {
        answer = t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )
      }

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    const begin = () => {
      isAiSpeakingRef.current = true
      setIsAiSpeaking(true)

      // на время TTS выключаем распознавание, чтобы не ловить голос ассистента
      if (engineRef.current === "speech") {
        stopSpeechRecognition()
      } else {
        // iOS pause/resume часто нестабильны
        if (!isIosLike()) {
          const rec = recorderRef.current
          if (rec && rec.state === "recording") {
            try {
              rec.pause()
            } catch {}
          }
        }
      }
    }

    const finish = () => {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)

      // восстановить распознавание
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        if (engineRef.current === "speech") {
          void startSpeechEngine()
        } else {
          if (!isIosLike()) {
            const rec = recorderRef.current
            if (rec && rec.state === "paused") {
              try {
                rec.resume()
              } catch {}
            }
          }
        }
      }
    }

    ;(async () => {
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
          finish()
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

        audio.onplay = () => begin()
        audio.onended = () => {
          finish()
          audioRef.current = null
        }
        audio.onerror = () => {
          finish()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch {
          finish()
        }
      } catch {
        finish()
      }
    })()
  }

  function startVadLoop() {
    const analyser = analyserRef.current
    if (!analyser) return

    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.1

    if (!floatBufRef.current || floatBufRef.current.length !== analyser.fftSize) {
      floatBufRef.current = new Float32Array(analyser.fftSize)
    }

    const MIN_SPEECH_MS = 140
    const END_SILENCE_MS = 900
    const MAX_SEGMENT_MS = 25000
    const MIN_TOTAL_MS = 500

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)

      if (!isCallActiveRef.current) return
      if (engineRef.current !== "recorder") return
      if (!analyserRef.current) return
      if (isMicMutedRef.current) return
      if (isAiSpeakingRef.current) return

      const now = performance.now()
      const data = floatBufRef.current!

      ;(analyserRef.current as any).getFloatTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = data[i]
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      const nf = noiseFloorRef.current
      const thr = Math.max(nf * 3.5, 0.01)

      const above = rms > thr
      if (above) {
        if (!aboveAtRef.current) aboveAtRef.current = now
      } else {
        aboveAtRef.current = 0
      }

      const speakingNow = aboveAtRef.current ? now - aboveAtRef.current >= MIN_SPEECH_MS : false

      if (!speakingRef.current && speakingNow) {
        speakingRef.current = true
        hadSpeechRef.current = true
        lastVoiceAtRef.current = now
        if (!segStartedAtRef.current) segStartedAtRef.current = now
        dlog("[VAD] speech start")
      }

      if (speakingRef.current && speakingNow) {
        lastVoiceAtRef.current = now
      }

      if (speakingRef.current && !speakingNow) {
        speakingRef.current = false
      }

      if (!speakingNow) {
        noiseFloorRef.current = nf * 0.995 + rms * 0.005
      }

      if (debugEnabled && now - lastVadLogAtRef.current > 1000) {
        lastVadLogAtRef.current = now
        dlog("[VAD]", {
          rms: Number(rms.toFixed(4)),
          noise: Number(noiseFloorRef.current.toFixed(4)),
          thr: Number(thr.toFixed(4)),
          speaking: speakingRef.current,
          rec: recorderRef.current?.state || "none",
        })
      }

      if (!hadSpeechRef.current) return

      const segStart = segStartedAtRef.current || now
      const segMs = now - segStart
      const silenceMs = now - (lastVoiceAtRef.current || segStart)

      if (segMs >= MAX_SEGMENT_MS) {
        void finalizeSegment("max")
        return
      }

      if (segMs < MIN_TOTAL_MS) return

      if (!speakingRef.current && silenceMs >= END_SILENCE_MS) {
        void finalizeSegment("silence")
        return
      }
    }

    safeStopRaf()
    rafRef.current = requestAnimationFrame(tick)
  }

  async function finalizeSegment(reason: string) {
    if (!isCallActiveRef.current) return
    if (engineRef.current !== "recorder") return
    if (finalizeInFlightRef.current) return
    if (isMicMutedRef.current) return
    if (isAiSpeakingRef.current) return

    const rec = recorderRef.current
    if (!rec) return
    if (rec.state === "inactive") return

    finalizeInFlightRef.current = true
    dlog("[SEG] finalize", reason, { bytes: bytesRef.current, state: rec.state })

    try {
      rec.stop()
    } catch {
      finalizeInFlightRef.current = false
    }
  }

  function startRecorder(stream: MediaStream) {
    const { mimeType, fallbackType } = pickRecorderMimeType()

    chunksRef.current = []
    bytesRef.current = 0
    speakingRef.current = false
    hadSpeechRef.current = false
    aboveAtRef.current = 0
    segStartedAtRef.current = performance.now()
    lastVoiceAtRef.current = 0
    finalizeInFlightRef.current = false

    const opts: MediaRecorderOptions = {}
    if (mimeType) opts.mimeType = mimeType

    const rec = new MediaRecorder(stream, opts)
    recorderRef.current = rec

    rec.onstart = () => {
      setIsListening(true)
      dlog("[REC] start", rec.mimeType || fallbackType)

      // если за 1.8s вообще не появилось байт — значит на ПК recorder не пишет/трек умер
      safeClearTimer(zeroBytesTimerRef)
      zeroBytesTimerRef.current = window.setTimeout(() => {
        if (!isCallActiveRef.current) return
        if (engineRef.current !== "recorder") return
        if (bytesRef.current > 0) return

        dlog("[REC] zero bytes -> fallback to SpeechRecognition")
        void switchToSpeechEngine("zero-bytes")
      }, 1800)
    }

    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
        bytesRef.current += e.data.size
      }
    }

    rec.onerror = (e: any) => {
      dlog("[REC] error", e?.name || e, e?.message || "")
    }

    rec.onstop = () => {
      setIsListening(false)
      safeClearTimer(zeroBytesTimerRef)

      const blobType =
        (rec.mimeType && rec.mimeType.split(";")[0]) ||
        chunksRef.current[0]?.type ||
        fallbackType ||
        "audio/webm"

      const blob = new Blob(chunksRef.current, { type: blobType })
      dlog("[REC] stop -> blob", { size: blob.size, type: blobType })

      chunksRef.current = []
      bytesRef.current = 0
      speakingRef.current = false
      hadSpeechRef.current = false
      aboveAtRef.current = 0
      segStartedAtRef.current = performance.now()
      lastVoiceAtRef.current = 0
      finalizeInFlightRef.current = false

      // если blob=0 на ПК — это тот же кейс, что на скрине. Сразу фолбэк.
      if (blob.size === 0 && isCallActiveRef.current && engineRef.current === "recorder") {
        void switchToSpeechEngine("blob-zero")
        return
      }

      if (isCallActiveRef.current && engineRef.current === "recorder" && !isMicMutedRef.current) {
        try {
          startRecorder(stream)
        } catch {}
      }

      if (blob.size >= 7000) {
        void sendToStt(blob)
      }
    }

    rec.start(1000)
    setIsListening(true)
  }

  async function startRecorderEngine() {
    setEngine("recorder")
    engineRef.current = "recorder"

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error("getUserMedia not supported")
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any,
    })

    streamRef.current = stream

    const track = stream.getAudioTracks()[0]
    if (track) {
      try {
        track.onended = () => {
          dlog("[MIC] track ended")
          // если трек умер — сразу переключаемся на speech engine
          void switchToSpeechEngine("track-ended")
        }
      } catch {}
    }

    // AudioContext/VAD: делаем “полный граф” через gain=0 -> destination
    // (на Mac/Chrome это часто стабилизирует WebAudio renderer)
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        const ctx: AudioContext = new AudioCtx({ latencyHint: "interactive" } as any)
        audioCtxRef.current = ctx
        try {
          await ctx.resume()
        } catch {}

        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        const gain0 = ctx.createGain()
        gain0.gain.value = 0

        analyserRef.current = analyser
        gain0Ref.current = gain0

        src.connect(analyser)
        analyser.connect(gain0)
        gain0.connect(ctx.destination)

        startVadLoop()
      }
    } catch (e: any) {
      dlog("[VAD] init error", e?.message || e)
      // если WebAudio падает — всё равно пишем recorder, VAD просто не будет
    }

    startRecorder(stream)
  }

  async function startSpeechEngine() {
    setEngine("speech")
    engineRef.current = "speech"

    stopSpeechRecognition()

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SR) {
      throw new Error("SpeechRecognition not supported")
    }

    const sr = new SR()
    speechRecRef.current = sr

    sr.lang = computeLangCode()
    sr.continuous = true
    sr.interimResults = false
    sr.maxAlternatives = 1

    sr.onresult = (event: any) => {
      if (!isCallActiveRef.current) return
      if (isMicMutedRef.current) return
      if (isAiSpeakingRef.current) return

      try {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]
          if (!r || !r.isFinal) continue
          const text = (r[0]?.transcript || "").toString().trim()
          if (!text) continue

          dlog("[SR] final", text)

          const userMsg: VoiceMessage = {
            id: `${Date.now()}-user`,
            role: "user",
            text,
          }
          setMessages((prev) => [...prev, userMsg])
          void handleUserText(text)
        }
      } catch {}
    }

    sr.onerror = (e: any) => {
      dlog("[SR] error", e?.error || e?.message || e)
      // типовые: "no-speech", "audio-capture", "not-allowed"
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setNetworkError(
          t(
            "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
        cleanupAll()
        return
      }
      // мягко перезапустим
    }

    sr.onend = () => {
      if (!isCallActiveRef.current) return
      if (engineRef.current !== "speech") return
      if (isMicMutedRef.current) return
      if (isAiSpeakingRef.current) return

      safeClearTimer(speechRestartTimerRef)
      speechRestartTimerRef.current = window.setTimeout(() => {
        if (!isCallActiveRef.current) return
        if (engineRef.current !== "speech") return
        try {
          sr.start()
          setIsListening(true)
        } catch {}
      }, 200)
    }

    try {
      sr.start()
      setIsListening(true)
    } catch (e: any) {
      dlog("[SR] start failed", e?.message || e)
      throw e
    }
  }

  async function switchToSpeechEngine(reason: string) {
    if (!isCallActiveRef.current) return
    dlog("[ENGINE] switch -> speech", reason)

    // остановить recorder + WebAudio, но не "убивать" UI
    safeClearTimer(zeroBytesTimerRef)
    try {
      stopRecorderOnly()
    } catch {}
    try {
      closeAudioContext()
    } catch {}
    try {
      stopTracks()
    } catch {}

    chunksRef.current = []
    bytesRef.current = 0
    finalizeInFlightRef.current = false

    try {
      await startSpeechEngine()
      setNetworkError(null)
    } catch {
      setNetworkError(t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."))
      cleanupAll()
    }
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender
    setSelectedGender(gender)

    setIsConnecting(true)
    setNetworkError(null)

    isCallActiveRef.current = true
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(true)
    setIsMicMuted(false)
    setIsAiSpeaking(false)

    try {
      await startRecorderEngine()
      setIsConnecting(false)
      setEngine("recorder")
      engineRef.current = "recorder"
    } catch (e: any) {
      dlog("[CALL] recorder engine failed -> speech", e?.message || e)
      try {
        await startSpeechEngine()
        setIsConnecting(false)
        setEngine("speech")
        engineRef.current = "speech"
      } catch {
        setIsConnecting(false)
        setNetworkError(
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
        cleanupAll()
      }
    }
  }

  const endCall = () => {
    dlog("[CALL] end")
    cleanupAll()

    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    } catch {}

    try {
      if (typeof window !== "undefined" && (window as any).speechSynthesis) {
        ;(window as any).speechSynthesis.cancel()
      }
    } catch {}
  }

  const toggleMic = () => {
    const next = !isMicMutedRef.current
    isMicMutedRef.current = next
    setIsMicMuted(next)

    if (engineRef.current === "speech") {
      if (next) {
        stopSpeechRecognition()
        setIsListening(false)
      } else {
        void startSpeechEngine()
      }
      return
    }

    const rec = recorderRef.current
    if (!rec) return

    if (next) {
      try {
        if (rec.state === "recording") rec.pause()
      } catch {}
      setIsListening(false)
    } else {
      try {
        if (rec.state === "paused") rec.resume()
      } catch {}
      setIsListening(true)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endCall()
      setMessages([])
      setNetworkError(null)
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
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
                        selectedGender === "female"
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100"
                      }`}
                    >
                      {isConnecting && selectedGender === "female" ? (
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
                        selectedGender === "male"
                          ? "bg-sky-600 text-white hover:bg-sky-700"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
                    >
                      {isConnecting && selectedGender === "male" ? (
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

                  {debugEnabled && (
                    <div className="text-[10px] text-slate-400">
                      engine: {engine}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
