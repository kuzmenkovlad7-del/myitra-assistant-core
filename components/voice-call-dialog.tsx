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
import {
  Phone,
  Wifi,
  WifiOff,
  Brain,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
} from "lucide-react"
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

function diffTranscript(prev: string, full: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  full = full.trim()
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

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("debug") === "1"
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ]
  for (const t of candidates) {
    try {
      if ((MediaRecorder as any).isTypeSupported?.(t)) return t
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

  const debug = useMemo(() => isDebugEnabled(), [])
  const dlog = (...args: any[]) => {
    if (!debug) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected")

  // маленький debug-статус, чтобы видеть что реально происходит (и не спамить консоль)
  const [debugLine, setDebugLine] = useState<string>("")

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const analyserDataRef = useRef<Float32Array | null>(null)
  const vadRafRef = useRef<number | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bytesRef = useRef<number>(0)

  const isCallActiveRef = useRef(false)
  const isSttBusyRef = useRef(false)
  const pendingBlobRef = useRef<{ blob: Blob; type: string } | null>(null)
  const lastTranscriptRef = useRef("")

  // VAD состояние
  const noiseRef = useRef(0.003) // стартовая “шумовая полка”
  const speakingRef = useRef(false)
  const speechEverRef = useRef(false) // была ли речь в текущем сегменте
  const lastVoiceAtRef = useRef<number>(0)
  const segmentStartedAtRef = useRef<number>(0)

  const lastDebugAtRef = useRef<number>(0)

  // автоскролл
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
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  function updateDebugLine(extra?: string) {
    if (!debug) return
    const rec = mediaRecorderRef.current
    const tr = trackRef.current
    const recState = rec?.state || "none"
    const trState = tr?.readyState || "none"
    const muted = (tr as any)?.muted ? "muted" : "unmuted"
    const enabled = tr?.enabled === false ? "disabled" : "enabled"
    const bytes = bytesRef.current
    setDebugLine(
      `debug: bytes=${bytes} rec=${recState} track=${trState}/${muted}/${enabled}${
        extra ? " | " + extra : ""
      }`,
    )
  }

  async function sendSttBlob(blob: Blob, contentType: string) {
    if (!isCallActiveRef.current) return

    // очередь из 1 сегмента: если занято — подменяем pending (нам важнее “последнее”)
    if (isSttBusyRef.current) {
      pendingBlobRef.current = { blob, type: contentType }
      dlog("[STT] busy -> queued last blob", blob.size, contentType)
      return
    }

    isSttBusyRef.current = true
    try {
      dlog("[STT] send", { size: blob.size, type: contentType })

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": contentType || "audio/webm",
          "x-language": computeLangCode(),
        },
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

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) return

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }
      setMessages((prevMsgs) => [...prevMsgs, userMsg])
      await handleUserText(delta)
    } catch (e: any) {
      dlog("[STT] fatal", e?.message || e)
    } finally {
      isSttBusyRef.current = false
      const pending = pendingBlobRef.current
      pendingBlobRef.current = null
      if (pending && isCallActiveRef.current) {
        // сразу отправляем накопившийся последний сегмент
        void sendSttBlob(pending.blob, pending.type)
      }
    }
  }

  function pauseRecordingForTts() {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "recording") {
      try {
        rec.pause()
        dlog("[REC] pause for TTS")
      } catch {
        // ignore
      }
    }
  }

  function resumeRecordingAfterTts() {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "paused" && isCallActiveRef.current && !isMicMuted) {
      try {
        rec.resume()
        dlog("[REC] resume after TTS")
      } catch {
        // ignore
      }
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    ;(async () => {
      try {
        setIsAiSpeaking(true)
        pauseRecordingForTts()

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
          setIsAiSpeaking(false)
          resumeRecordingAfterTts()
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

        audio.onended = () => {
          setIsAiSpeaking(false)
          audioRef.current = null
          resumeRecordingAfterTts()
        }
        audio.onerror = () => {
          setIsAiSpeaking(false)
          audioRef.current = null
          resumeRecordingAfterTts()
        }

        try {
          await audio.play()
        } catch {
          setIsAiSpeaking(false)
          audioRef.current = null
          resumeRecordingAfterTts()
        }
      } catch {
        setIsAiSpeaking(false)
        resumeRecordingAfterTts()
      }
    })()
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

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`)
      }

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // string
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
      speakText(answer)
    } catch (error: any) {
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  function cleanupVAD() {
    if (vadRafRef.current) {
      cancelAnimationFrame(vadRafRef.current)
      vadRafRef.current = null
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {}
      analyserRef.current = null
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {}
      audioCtxRef.current = null
    }
    analyserDataRef.current = null
  }

  function stopRecorderOnly() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null
    setIsListening(false)
  }

  function stopAllAudio() {
    stopRecorderOnly()

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
    }
    mediaStreamRef.current = null
    trackRef.current = null

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      audioRef.current = null
    }

    cleanupVAD()
  }

  async function stopAndSendSegment(reason: string) {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "inactive") return

    // не отправляем пустые/без речи сегменты
    if (!speechEverRef.current) {
      dlog("[SEG] stop ignored (no speech yet)", reason)
      // просто перезапускаем сегмент, чтобы не копить мусор
      try {
        rec.stop()
      } catch {}
      return
    }

    dlog("[SEG] stop -> finalize", reason, "bytes=", bytesRef.current)

    try {
      rec.stop()
    } catch {
      // ignore
    }
  }

  function startNewSegment(stream: MediaStream) {
    const mimeType = pickMimeType()
    const options: MediaRecorderOptions = {}
    if (mimeType) options.mimeType = mimeType

    chunksRef.current = []
    bytesRef.current = 0
    speechEverRef.current = false
    speakingRef.current = false
    lastVoiceAtRef.current = 0
    segmentStartedAtRef.current = Date.now()
    updateDebugLine("segment-start")

    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, options)
    } catch (e) {
      // fallback без options
      rec = new MediaRecorder(stream)
    }

    mediaRecorderRef.current = rec

    rec.onstart = () => {
      setIsListening(true)
      dlog("[REC] onstart", { mimeType: rec.mimeType || mimeType || "unknown" })
    }

    rec.ondataavailable = (ev: BlobEvent) => {
      const data = ev.data
      if (!data || data.size <= 0) return

      chunksRef.current.push(data)
      bytesRef.current += data.size

      const now = Date.now()
      if (debug && now - lastDebugAtRef.current > 1000) {
        lastDebugAtRef.current = now
        dlog("[REC] chunk", { size: data.size, totalBytes: bytesRef.current })
        updateDebugLine(`chunk=${data.size}`)
      }
    }

    rec.onerror = (ev: any) => {
      dlog("[REC] error", ev?.name || ev, ev?.message || "")
    }

    rec.onstop = async () => {
      setIsListening(false)

      const mime = rec.mimeType || mimeType || "audio/webm"
      const blob = new Blob(chunksRef.current, { type: mime })

      // очистка текущих чанков сразу (чтобы не копилось)
      chunksRef.current = []
      bytesRef.current = 0
      updateDebugLine("stopped")

      // если сегмент без речи или слишком маленький — не шлём
      if (!speechEverRef.current) {
        dlog("[SEG] finalized but no speech -> restart")
        if (isCallActiveRef.current && mediaStreamRef.current) {
          startNewSegment(mediaStreamRef.current)
          if (isAiSpeaking || isMicMuted) pauseRecordingForTts()
        }
        return
      }

      // маленькие сегменты тоже игнорим
      if (blob.size < 12000) {
        dlog("[SEG] too small -> restart", blob.size)
        if (isCallActiveRef.current && mediaStreamRef.current) {
          startNewSegment(mediaStreamRef.current)
          if (isAiSpeaking || isMicMuted) pauseRecordingForTts()
        }
        return
      }

      await sendSttBlob(blob, mime)

      // стартуем новый сегмент после отправки
      if (isCallActiveRef.current && mediaStreamRef.current) {
        startNewSegment(mediaStreamRef.current)
        if (isAiSpeaking || isMicMuted) pauseRecordingForTts()
      }
    }

    // timeslice 1000ms: VAD решает, когда стопнуть сегмент
    try {
      rec.start(1000)
      dlog("[REC] start(1000)")
    } catch (e: any) {
      dlog("[REC] start failed", e?.message || e)
      throw e
    }
  }

  function startVAD(stream: MediaStream) {
    cleanupVAD()

    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) {
      dlog("[VAD] AudioContext not supported")
      return
    }

    const ctx: AudioContext = new AC({ latencyHint: "interactive" })
    audioCtxRef.current = ctx

    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.2
    src.connect(analyser)
    analyserRef.current = analyser
    analyserDataRef.current = new Float32Array(analyser.fftSize)

    // важное: на десктопе контекст может быть suspended — пытаемся резюмнуть
    try {
      if (ctx.state === "suspended") void ctx.resume()
    } catch {}

    const END_SILENCE_MS = 1200        // паузы пользователя
    const MIN_SPEECH_MS = 250          // чтобы шум не считался речью
    const MAX_SEGMENT_MS = 30000       // защита от “вечной речи”
    const BASE_ADD = 0.0025            // добавка к шуму (чувствительность)

    let speechBeganAt = 0

    const tick = () => {
      if (!isCallActiveRef.current) return

      const rec = mediaRecorderRef.current
      const tr = trackRef.current
      const analyser = analyserRef.current
      const data = analyserDataRef.current

      if (!rec || !tr || !analyser || !data) {
        vadRafRef.current = requestAnimationFrame(tick)
        return
      }

      // если muted / ended — сразу показываем понятную ошибку
      if (tr.readyState === "ended") {
        setNetworkError(
          t("Microphone stopped unexpectedly. Please reload the page and try again."),
        )
        updateDebugLine("track-ended")
        vadRafRef.current = requestAnimationFrame(tick)
        return
      }

      // во время TTS или mute — VAD не триггерит конец речи
      if (isAiSpeaking || isMicMuted) {
        vadRafRef.current = requestAnimationFrame(tick)
        return
      }

      analyser.getFloatTimeDomainData(data as any)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = data[i]
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      // адаптивный шум (плавно)
      // когда “не говорим” — шум обновляем быстрее, когда “говорим” — медленнее
      const noise = noiseRef.current
      if (!speakingRef.current) {
        noiseRef.current = noise * 0.97 + rms * 0.03
      } else {
        noiseRef.current = noise * 0.995 + rms * 0.005
      }

      // порог: шум + BASE_ADD, плюс минимум
      const thr = Math.max(noiseRef.current + BASE_ADD, 0.006)

      const now = Date.now()
      const isVoice = rms > thr

      if (debug && now - lastDebugAtRef.current > 1000) {
        lastDebugAtRef.current = now
        dlog("[VAD]", {
          rms: Number(rms.toFixed(4)),
          noise: Number(noiseRef.current.toFixed(4)),
          thr: Number(thr.toFixed(4)),
          voice: isVoice,
          rec: rec.state,
        })
        updateDebugLine(
          `rms=${rms.toFixed(4)} thr=${thr.toFixed(4)} voice=${isVoice}`,
        )
      }

      if (isVoice) {
        if (!speakingRef.current) {
          speakingRef.current = true
          speechBeganAt = now
        }
        lastVoiceAtRef.current = now

        // речь считается “реальной”, только если держится MIN_SPEECH_MS
        if (!speechEverRef.current && speechBeganAt && now - speechBeganAt >= MIN_SPEECH_MS) {
          speechEverRef.current = true
          dlog("[VAD] speech confirmed")
        }
      } else {
        if (speakingRef.current) {
          // “переключились в тишину”
          speakingRef.current = false
        }

        // если речь уже была и сейчас тишина достаточно долго — заканчиваем сегмент
        if (speechEverRef.current) {
          const silenceFor = lastVoiceAtRef.current ? now - lastVoiceAtRef.current : 0
          if (silenceFor >= END_SILENCE_MS) {
            void stopAndSendSegment("vad-silence")
          }
        }
      }

      // защита от бесконечного сегмента (только если речь уже была)
      const segDur = now - segmentStartedAtRef.current
      if (speechEverRef.current && segDur >= MAX_SEGMENT_MS) {
        void stopAndSendSegment("max-seg")
      }

      vadRafRef.current = requestAnimationFrame(tick)
    }

    vadRafRef.current = requestAnimationFrame(tick)
  }

  const startCall = async (gender: "female" | "male") => {
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

      // важное: НЕ делаем enumerate/переключения девайса в проде — это и грузит, и ломает UX
      // просто просим дефолтный микрофон
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      const tr = stream.getAudioTracks()[0] || null
      trackRef.current = tr

      if (tr) {
        tr.onended = () => {
          dlog("[MIC] track ended")
          updateDebugLine("track-ended")
        }
        ;(tr as any).onmute = () => dlog("[MIC] track muted")
        ;(tr as any).onunmute = () => dlog("[MIC] track unmuted")
      }

      dlog("[CALL] getUserMedia OK", {
        label: tr?.label,
        settings: tr?.getSettings?.(),
      })

      // сброс текста/стейта распознавания
      lastTranscriptRef.current = ""
      pendingBlobRef.current = null
      isSttBusyRef.current = false

      // стартуем сегмент-рекордер
      startNewSegment(stream)

      // стартуем VAD
      startVAD(stream)

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
      setConnectionStatus("connected")

      updateDebugLine("call-start")
    } catch (error: any) {
      dlog("[CALL] getUserMedia error", error?.name, error?.message)

      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
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
      setConnectionStatus("disconnected")
      stopAllAudio()
    }
  }

  const endCall = () => {
    dlog("[CALL] end")

    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setDebugLine("")

    chunksRef.current = []
    bytesRef.current = 0
    speechEverRef.current = false
    speakingRef.current = false
    lastVoiceAtRef.current = 0
    segmentStartedAtRef.current = 0

    pendingBlobRef.current = null
    isSttBusyRef.current = false
    lastTranscriptRef.current = ""

    stopAllAudio()

    try {
      ;(window as any).speechSynthesis?.cancel?.()
    } catch {}
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
          dlog("[CALL] mic mute -> rec.pause()")
        } catch {}
      }
    } else {
      if (rec.state === "paused" && isCallActiveRef.current && !isAiSpeaking) {
        try {
          rec.resume()
          dlog("[CALL] mic unmute -> rec.resume()")
        } catch {}
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
                {debug && (
                  <div className="mt-2 text-[11px] text-indigo-100/90">
                    {debugLine}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 text-[11px] text-indigo-100">
                <div className="flex items-center gap-1">
                  {connectionStatus === "connected" ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-200" />
                      {t("Connected")}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-rose-200" />
                      {t("Disconnected")}
                    </>
                  )}
                </div>
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
