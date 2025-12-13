"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { X, Mic, MicOff, Camera, CameraOff, Phone, Volume2, VolumeX, Brain, Video } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { getLocaleForLanguage, getNativeSpeechParameters, getNativeVoicePreferences } from "@/lib/i18n/translation-utils"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

const STT_ENDPOINT = "/api/stt"

// локальные конфиги (если у тебя в generateGoogleTTS разные сигнатуры — ниже safeGenerateGoogleTTS)
const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}
const VIDEO_CALL_VOICE_CONFIGS: any = {
  uk: {
    female: { languageCode: "uk-UA", name: "uk-UA-Standard-A", ssmlGender: "FEMALE" },
    male: { languageCode: "uk-UA", name: "uk-UA-Chirp3-HD-Schedar", ssmlGender: "MALE" },
  },
  ru: {
    female: { languageCode: "ru-RU", name: "ru-RU-Standard-A", ssmlGender: "FEMALE" },
    male: { languageCode: "ru-RU", name: "ru-RU-Standard-B", ssmlGender: "MALE" },
  },
  en: {
    female: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
    male: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
  },
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  voice: string
  animated?: boolean
  idleVideo?: string
  speakingVideo?: string
}

const AI_CHARACTERS: AICharacter[] = [
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description: "Senior psychologist specializing in cognitive behavioral therapy with 15+ years of experience",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    voice: "en-US-GuyNeural",
    animated: true,
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
  },
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description: "Clinical psychologist specializing in anxiety, depression, and workplace stress management",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    voice: "en-US-JennyNeural",
    animated: true,
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description: "Psychotherapist specializing in emotional regulation, trauma recovery, and relationship counseling",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    voice: "en-US-JennyNeural",
    animated: true,
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9963-sneJ4XhoEuemkYgVb425Mscu7X9OC6.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
  },
]

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey?: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

function pickBestRecorderMimeType(): string | undefined {
  const MR: any = typeof window !== "undefined" ? (window as any).MediaRecorder : null
  if (!MR?.isTypeSupported) return undefined

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/mpeg",
  ]
  for (const t of candidates) {
    try {
      if (MR.isTypeSupported(t)) return t
    } catch {}
  }
  return undefined
}

function filenameForMime(mime: string): string {
  const m = (mime || "").toLowerCase()
  if (m.includes("webm")) return "speech.webm"
  if (m.includes("mp4")) return "speech.mp4"
  if (m.includes("mpeg") || m.includes("mp3")) return "speech.mp3"
  if (m.includes("wav")) return "speech.wav"
  if (m.includes("ogg")) return "speech.ogg"
  return "speech.bin"
}

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (first.output || first.response || first.text || first.message || first.content || first.result || JSON.stringify(first))
      ?.toString()
      .trim()
  }

  if (typeof data === "object") {
    return (data.output || data.response || data.text || data.message || data.content || data.result || JSON.stringify(data))
      ?.toString()
      .trim()
  }

  return ""
}

function cleanResponseText(text: string): string {
  if (!text) return ""
  if (text.startsWith('[{"output":')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) return String(parsed[0].output).trim()
    } catch {}
  }
  return text.replace(/\n\n/g, " ").replace(/\*\*/g, "").replace(/```/g, "").replace(/[\n\r]/g, " ").trim()
}

export default function VideoCallDialog({ isOpen, onClose, openAiApiKey, onError }: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const activeLanguage = currentLanguage || ({ code: "en", name: "English", flag: "🇺🇸" } as any)
  const languageDisplayName =
    ((activeLanguage as any).name ?? ((activeLanguage as any).label ?? ((activeLanguage as any).nativeName))) ||
    (activeLanguage.code === "uk" ? "Ukrainian" : activeLanguage.code === "ru" ? "Russian" : "English")

  const currentLocale = getLocaleForLanguage(activeLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(AI_CHARACTERS[1] || AI_CHARACTERS[0])

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)     // ВАЖНО: стартуем с ON (как “слушаю”)
  const [isCameraOff, setIsCameraOff] = useState(true)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<"listening" | "thinking" | "speaking">("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")

  // debug overlay (включить: ?debug=1)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugLines, setDebugLines] = useState<string[]>([])
  const debugEnabledRef = useRef(false)

  // video/audio refs
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)

  // MediaRecorder STT (основной путь и на Android, и на iOS)
  const supportsMediaRecorder = useMemo(() => {
    if (typeof window === "undefined") return false
    return !!(navigator.mediaDevices && (window as any).MediaRecorder)
  }, [])

  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const sttQueueRef = useRef<Blob[]>([])
    const sttInitRef = useRef<Blob | null>(null)
  const sttBusyRef = useRef(false)
  const lastTranscriptRef = useRef<string>("")
  const suppressUntilRef = useRef<number>(0)
  const isAiSpeakingRef = useRef(false)

  const hasEnhancedVideo = !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    if (typeof window === "undefined") return
    const enabled = new URLSearchParams(window.location.search).get("debug") === "1"
    setDebugEnabled(enabled)
    debugEnabledRef.current = enabled
  }, [])

  function dlog(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(...args)
    if (!debugEnabledRef.current) return
    const line =
      `[${new Date().toLocaleTimeString()}] ` +
      args
        .map((a) => {
          if (typeof a === "string") return a
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(" ")
    setDebugLines((prev) => [...prev, line].slice(-160))
  }

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  // voices preload
  useEffect(() => {
    if (typeof window === "undefined") return
    const synth: any = (window as any).speechSynthesis
    if (!synth) return

    const load = () => {
      try {
        if (typeof synth.getVoices === "function") synth.getVoices()
      } catch {}
    }

    load()

    if (typeof synth.addEventListener === "function" && typeof synth.removeEventListener === "function") {
      try {
        synth.addEventListener("voiceschanged", load)
      } catch {}
      return () => {
        try {
          synth.removeEventListener("voiceschanged", load)
        } catch {}
      }
    }

    const prev = synth.onvoiceschanged
    try {
      synth.onvoiceschanged = load
    } catch {}
    return () => {
      try {
        if (synth.onvoiceschanged === load) synth.onvoiceschanged = prev ?? null
      } catch {}
    }
  }, [])

  // close modal -> stop call
  useEffect(() => {
    if (!isOpen && isCallActive) endCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function stopCurrentSpeech() {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
      } catch {}
      currentAudioRef.current = null
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    currentUtteranceRef.current = null
  }

  function getRefinedVoiceForLanguage(langCode: string, preferredGender: "female" | "male" = "female"): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null

    const cacheKey = `${langCode}-${preferredGender}-${selectedCharacter?.id ?? "none"}`
    const cache = voiceCacheRef.current
    if (cache.has(cacheKey)) return cache.get(cacheKey) || null

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    const nativeList = nativeVoicePreferences[langCode]?.[preferredGender] || []
    for (const name of nativeList) {
      const v = voices.find((voice) => voice.name === name)
      if (v) {
        cache.set(cacheKey, v)
        return v
      }
    }

    const langVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith(langCode.toLowerCase()))
    if (langVoices.length) {
      cache.set(cacheKey, langVoices[0]!)
      return langVoices[0]!
    }

    if (langCode !== "en") {
      const en = getRefinedVoiceForLanguage("en", preferredGender)
      if (en) {
        cache.set(cacheKey, en)
        return en
      }
    }

    cache.set(cacheKey, voices[0]!)
    return voices[0]!
  }

  function browserSpeak(text: string, gender: "male" | "female", onDone: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return onDone()

    try {
      window.speechSynthesis.cancel()
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = currentLocale

    const voice = getRefinedVoiceForLanguage(activeLanguage.code, gender)
    if (voice) utterance.voice = voice

    const params = getNativeSpeechParameters(activeLanguage.code, gender)
    utterance.rate = params.rate
    utterance.pitch = params.pitch
    utterance.volume = params.volume

    currentUtteranceRef.current = utterance
    utterance.onend = () => onDone()
    utterance.onerror = () => onDone()

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      onDone()
    }
  }

  async function safeGenerateGoogleTTS(text: string, locale: string, gender: "male" | "female") {
    const fn: any = generateGoogleTTS as any
    if (typeof fn !== "function") return null
    try {
      if (fn.length >= 5) return await fn(text, locale, gender, VIDEO_CALL_GOOGLE_TTS_CREDENTIALS, VIDEO_CALL_VOICE_CONFIGS)
      if (fn.length === 3) return await fn(text, locale, gender)
      if (fn.length === 2) return await fn(text, locale)
      return await fn(text)
    } catch {
      return null
    }
  }

  // unlock audio after user gesture
  async function unlockMobileAudioOnce() {
    try {
      const a = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/jQwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
      )
      a.setAttribute("playsinline", "true")
      a.setAttribute("webkit-playsinline", "true")
      a.volume = 0.01
      await a.play().catch(() => {})
      try {
        a.pause()
        a.currentTime = 0
      } catch {}
    } catch {}
  }

  async function startUserCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return
    if (!userVideoRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      userVideoRef.current.srcObject = stream
      setIsCameraOff(false)
    } catch {
      setIsCameraOff(true)
    }
  }

  function stopUserCamera() {
    if (!userVideoRef.current?.srcObject) return
    const stream = userVideoRef.current.srcObject as MediaStream
    stream.getTracks().forEach((t) => t.stop())
    userVideoRef.current.srcObject = null
  }

  async function transcribeBlobViaApi(blob: Blob): Promise<string> {
    const fd = new FormData()
    fd.append("file", blob, filenameForMime(blob.type || "audio/webm"))
    fd.append("language", activeLanguage.code || "uk")
    fd.append("locale", currentLocale)

    const res = await fetch(STT_ENDPOINT, { method: "POST", body: fd })
    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data || data.success === false) {
      dlog("[STT] error", res.status, raw)
      return ""
    }

    return String(data.text || "").trim()
  }

  async function maybeSendStt() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return
    if (isAiSpeakingRef.current) return
    if (Date.now() < suppressUntilRef.current) return
    if (sttBusyRef.current) return
    if (!sttQueueRef.current.length) return

    // берём ровно ОДИН валидный chunk (не склеиваем несколько файлов в один Blob)
      const chunk = sttQueueRef.current.shift()
      if (!chunk) return

      // Android/Chrome: первый чанк содержит init-сегмент webm, остальные без заголовка.
      // Чтобы Whisper принимал КАЖДЫЙ запрос — шлём init+chunk.
      if (!sttInitRef.current) sttInitRef.current = chunk

      let blob = chunk
      if (sttInitRef.current && sttInitRef.current !== chunk) {
        try {
          blob = new Blob([sttInitRef.current, chunk], { type: chunk.type || "audio/webm" })
        } catch {
          blob = chunk
        }
      }
    if (blob.size < 12000) return

    try {
      sttBusyRef.current = true
      setActivityStatus("thinking")
      dlog("[STT] sending chunk", { size: blob.size, type: blob.type })

      const text = await transcribeBlobViaApi(blob)
      dlog("[STT] text", text)

      if (!text) {
        setActivityStatus("listening")
        return
      }

      if (text === lastTranscriptRef.current) {
        setActivityStatus("listening")
        return
      }
      lastTranscriptRef.current = text

      await handleUserText(text)
    } catch (e: any) {
      dlog("[STT] fatal", e?.message || String(e))
      setSpeechError(t("Speech recognition failed. Please try again."))
      setActivityStatus("listening")
    } finally {
      sttBusyRef.current = false
    }
  }

  async function startMicRecorder() {
    if (!supportsMediaRecorder) {
      setSpeechError(t("Voice recording is not supported on this device."))
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setSpeechError(t("Your browser does not support microphone access."))
      return
    }
    if (!window.isSecureContext) {
      setSpeechError(t("Microphone requires HTTPS. Open the site via https://"))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      micStreamRef.current = stream

      const mimeType = pickBestRecorderMimeType()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaRecorderRef.current = mr
      sttQueueRef.current = []
        sttInitRef.current = null
      lastTranscriptRef.current = ""
      suppressUntilRef.current = 0

      mr.onstart = () => {
        setIsListening(true)
        setActivityStatus("listening")
        setSpeechError(null)
        dlog("[Recorder] onstart", { mimeType: mr.mimeType })
      }

      mr.ondataavailable = (e: BlobEvent) => {
        if (!isCallActiveRef.current) return
        if (isMicMutedRef.current) return
        if (isAiSpeakingRef.current) return
        if (e.data && e.data.size > 0) {
          sttQueueRef.current.push(e.data)
          void maybeSendStt()
        }
      }

      mr.onstop = () => {
        setIsListening(false)
        dlog("[Recorder] onstop")
      }

      mr.onerror = (e: any) => {
        dlog("[Recorder] error", e?.name || "", e?.message || "")
      }

      mr.start(3500)
    } catch (e: any) {
      dlog("[Recorder] getUserMedia error", e?.name || "", e?.message || "")
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        setSpeechError(t("Microphone access is blocked. Please allow microphone permission in the browser settings."))
      } else {
        setSpeechError(t("Unable to access microphone."))
      }
    }
  }

  function pauseMicRecorder() {
    sttQueueRef.current = []
        sttInitRef.current = null
    const mr = mediaRecorderRef.current
    if (!mr) return
    if (mr.state === "recording") {
      try {
        sttQueueRef.current = []
        sttInitRef.current = null
        try {
          mr.stop()
          dlog("[Recorder] stop() during TTS")
        } catch (e) {
          dlog("[Recorder] stop() failed", (e instanceof Error) ? e.message : String(e))
        }
} catch {}
    }
  }

  function resumeMicRecorder() {
    const mr = mediaRecorderRef.current
    if (!mr) return
    if (mr.state === "inactive") {
      try {
        sttQueueRef.current = []
        sttInitRef.current = null
        setTimeout(() => {
          try {
            mr.start(3500)
            dlog("[Recorder] start() after TTS")
          } catch (e) {
            dlog("[Recorder] start() failed", (e instanceof Error) ? e.message : String(e))
          }
        }, 250)
} catch {}
    }
  }

  function stopMicRecorder() {
    sttQueueRef.current = []
        sttInitRef.current = null
    const mr = mediaRecorderRef.current
    try {
      if (mr && mr.state !== "inactive") mr.stop()
    } catch {}
    mediaRecorderRef.current = null

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    setIsListening(false)
  }

  async function speakText(text: string) {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    stopCurrentSpeech()

    // ВАЖНО: глушим микрофон пока ассистент говорит (иначе ловим эхо)
    isAiSpeakingRef.current = true
    setIsAiSpeaking(true)
    setActivityStatus("speaking")
    suppressUntilRef.current = Date.now() + 900
    pauseMicRecorder()

    if (hasEnhancedVideo && speakingVideoRef.current && selectedCharacter.speakingVideo) {
      try {
        speakingVideoRef.current.currentTime = 0
        await speakingVideoRef.current.play()
      } catch {}
    }

    const gender: "male" | "female" = selectedCharacter.gender || "female"

    const finish = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false

      if (hasEnhancedVideo && speakingVideoRef.current) {
        try {
          speakingVideoRef.current.pause()
          speakingVideoRef.current.currentTime = 0
        } catch {}
      }

      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo && isCallActiveRef.current) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
        resumeMicRecorder()
      }
    }

    try {
      if (shouldUseGoogleTTS(activeLanguage.code)) {
        const audioDataUrl = await safeGenerateGoogleTTS(cleaned, currentLocale, gender)
        if (audioDataUrl) {
          await new Promise<void>((resolve) => {
            const audio = new Audio()
            currentAudioRef.current = audio
            audio.preload = "auto"
            audio.volume = 1
            audio.crossOrigin = "anonymous"
            audio.setAttribute("playsinline", "true")
            audio.setAttribute("webkit-playsinline", "true")
            audio.src = audioDataUrl
            audio.onended = () => resolve()
            audio.onerror = () => resolve()
            audio.play().catch(() => resolve())
          })
        } else {
          await new Promise<void>((resolve) => browserSpeak(cleaned, gender, resolve))
        }
      } else {
        await new Promise<void>((resolve) => browserSpeak(cleaned, gender, resolve))
      }
    } finally {
      finish()
    }
  }

  async function handleUserText(text: string) {
    const trimmed = String(text || "").trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    setMessages((prev) => [...prev, { id: prev.length + 1, role: "user", text: trimmed }])
    setActivityStatus("thinking")
    setSpeechError(null)
    setInterimTranscript("")

    try {
      const langForBackend =
        activeLanguage.code?.startsWith("uk") || activeLanguage.code?.startsWith("ru") || activeLanguage.code?.startsWith("en")
          ? activeLanguage.code
          : activeLanguage.code || "uk"

      const res = await fetch(VIDEO_ASSISTANT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          language: langForBackend,
          email: user?.email || "guest@example.com",
          mode: "video",
          characterId: selectedCharacter.id,
          gender: selectedCharacter.gender,
        }),
      })

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      if (!res.ok) throw new Error(`Webhook error: ${res.status} ${raw}`)

      const aiRaw = extractAnswer(data)
      const cleaned = cleanResponseText(aiRaw)
      if (!cleaned) throw new Error("Empty response received")

      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: cleaned }])
      await speakText(cleaned)
    } catch (error: any) {
      dlog("[CHAT] error", error?.message || String(error))
      const errorMessage = t("I couldn't process your message. Could you try again?")
      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: errorMessage }])
      if (onError && error instanceof Error) onError(error)
      setActivityStatus("listening")
    } finally {
      if (isCallActiveRef.current && !isMicMutedRef.current && !isAiSpeakingRef.current) {
        setActivityStatus("listening")
      }
    }
  }

  async function startCall() {
    if (isConnecting) return
    setIsConnecting(true)
    setSpeechError(null)

    try {
      await unlockMobileAudioOnce()

      setIsCallActive(true)
      isCallActiveRef.current = true

      setMessages([])
      setInterimTranscript("")
      setIsMicMuted(false)
      isMicMutedRef.current = false
      setIsListening(false)
      setActivityStatus("listening")

      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      // камера по кнопке — но можешь включить сразу если надо:
      // await startUserCamera()

      // сразу стартуем слушание через MediaRecorder→STT
      await startMicRecorder()
    } catch (e: any) {
      dlog("[CALL] startCall error", e?.message || String(e))
      setSpeechError(e?.message || t("Microphone access is blocked. Please allow permission and retry."))
      setIsCallActive(false)
      isCallActiveRef.current = false
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopMicRecorder()
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)
    setIsMicMuted(false)
    isMicMutedRef.current = false
    setIsListening(false)

    if (idleVideoRef.current) {
      try {
        idleVideoRef.current.pause()
        idleVideoRef.current.currentTime = 0
      } catch {}
    }
    if (speakingVideoRef.current) {
      try {
        speakingVideoRef.current.pause()
        speakingVideoRef.current.currentTime = 0
      } catch {}
    }

    stopUserCamera()
  }

  async function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    // выключаем
    if (!isMicMuted) {
      setIsMicMuted(true)
      isMicMutedRef.current = true
      setIsListening(false)
      setInterimTranscript("")
      pauseMicRecorder()
      setActivityStatus("listening")
      return
    }

    // включаем
    setSpeechError(null)
    setIsMicMuted(false)
    isMicMutedRef.current = false

    // если уже есть рекордер — просто resume
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      resumeMicRecorder()
      setIsListening(true)
      setActivityStatus("listening")
      return
    }

    await startMicRecorder()
  }

  function toggleCamera() {
    if (!isCallActiveRef.current) return
    if (isCameraOff) startUserCamera()
    else {
      stopUserCamera()
      setIsCameraOff(true)
    }
  }

  function toggleSound() {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      stopCurrentSpeech()
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
    }
  }

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (isMicMuted) return t("Paused. Turn on microphone to continue.")
    if (isListening) return t("Listening… you can speak.")
    return t("Waiting... you can start speaking at any moment.")
  })()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] sm:max-h-[860px] flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center relative bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Video className="h-4 w-4" />
              </span>
              {t("Video call with AI-psychologist")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
              {t("Video session in {{language}}", { language: languageDisplayName })} · {activeLanguage.flag}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              endCall()
              onClose()
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label={t("Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MAIN */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 touch-pan-y overscroll-contain">
          {!isCallActive ? (
            <div className="flex flex-col gap-4">
              <div className="text-center mt-1">
                <h3 className="text-xl sm:text-2xl font-semibold mb-2">{t("Choose your AI psychologist")}</h3>
                <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
                  {t("Select the AI psychologist you'd like to speak with during your video call.")}
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg w-full max-w-md mx-auto text-center">
                <p className="text-sm font-medium text-blue-700 mb-1">{t("Video call language")}:</p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{activeLanguage.flag}</span>
                  {languageDisplayName}
                </div>
              </div>

              <div className="w-full max-w-5xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {AI_CHARACTERS.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => setSelectedCharacter(character)}
                      className={`relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-2 ${
                        selectedCharacter.id === character.id ? "border-primary-600" : "border-transparent"
                      }`}
                    >
                      <div className="p-4 sm:p-5 flex flex-col h-full">
                        <div className="relative w-full aspect-square mb-3 overflow-hidden rounded-lg bg-black">
                          {character.idleVideo ? (
                            <video className="absolute inset-0 w-full h-full object-cover scale-[1.08]" muted loop playsInline autoPlay preload="auto">
                              <source src={character.idleVideo} type="video/mp4" />
                            </video>
                          ) : (
                            <Image
                              src={character.avatar || "/placeholder.svg"}
                              alt={character.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          )}
                        </div>

                        <h4 className="font-semibold text-base sm:text-lg text-center mb-1">{character.name}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 text-center mb-3">{character.description}</p>

                        <div className="mt-auto text-center">
                          <span
                            className={`inline-flex px-4 py-2 rounded-full text-xs font-medium ${
                              selectedCharacter.id === character.id ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {selectedCharacter.id === character.id ? t("Selected") : t("Select")}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* LEFT: VIDEO */}
              <div className="w-full sm:w-2/3 flex flex-col">
                <div className="relative w-full aspect-video sm:flex-1 bg-white rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-white overflow-hidden">
                    {hasEnhancedVideo ? (
                      <>
                        {selectedCharacter.idleVideo && (
                          <video
                            ref={idleVideoRef}
                            className="absolute inset-0 w-full h-full object-cover scale-[1.08]"
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="auto"
                          >
                            <source src={selectedCharacter.idleVideo} type="video/mp4" />
                          </video>
                        )}

                        {selectedCharacter.speakingVideo && (
                          <video
                            ref={speakingVideoRef}
                            className={`absolute inset-0 w-full h-full object-cover scale-[1.08] transition-opacity duration-700 ease-in-out ${
                              isAiSpeaking ? "opacity-100" : "opacity-0"
                            }`}
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="auto"
                          >
                            <source src={selectedCharacter.speakingVideo} type="video/mp4" />
                          </video>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <div className="w-40 h-40 sm:w-56 sm:h-56 relative">
                          <Image
                            src={selectedCharacter.avatar || "/placeholder.svg"}
                            alt={selectedCharacter.name}
                            fill
                            className="object-cover rounded-full"
                            sizes="224px"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={`absolute top-2 sm:top-4 right-2 sm:right-4 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                      activityStatus === "listening"
                        ? "bg-green-100 text-green-800"
                        : activityStatus === "thinking"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {activityStatus === "listening"
                      ? t("Listening...")
                      : activityStatus === "thinking"
                      ? t("Thinking...")
                      : t("Assistant is speaking...")}
                  </div>

                  {!isCameraOff && (
                    <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-20 sm:w-40 aspect-video bg-gray-800 rounded overflow-hidden shadow-lg">
                      <video ref={userVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: CHAT */}
              <div className="w-full sm:w-1/3 flex flex-col bg-gray-50 rounded-lg border overflow-hidden">
                <div className="px-3 pt-3 pb-2 border-b flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{selectedCharacter.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{statusText}</div>
                  </div>
                </div>

                <div className="flex-1 px-3 py-3 sm:px-4 sm:py-4 space-y-3 overflow-y-auto">
                  {messages.length === 0 && (
                    <div className="bg-primary-50 rounded-2xl p-3 text-xs sm:text-sm text-slate-800">
                      {t("You can start speaking when you're ready. The assistant will answer with voice and text here.")}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div key={msg.id} className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-3 text-xs sm:text-sm text-slate-900">
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div key={msg.id} className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs sm:text-sm text-slate-900">
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter.name}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ),
                  )}

                  {!!interimTranscript && (
                    <div className="bg-gray-50 rounded-lg p-3 italic text-xs sm:text-sm text-gray-500 break-words">
                      {interimTranscript}...
                    </div>
                  )}

                  {speechError && (
                    <div className="bg-rose-50 rounded-lg p-3 text-xs sm:text-sm text-rose-700 break-words">
                      {speechError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {!isCallActive ? (
          <div className="border-t bg-white p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="max-w-md mx-auto">
              <Button
                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-base sm:text-lg py-5 min-h-[56px]"
                onClick={startCall}
                disabled={isConnecting}
              >
                {isConnecting ? t("Connecting...") : t("Start video call")}
              </Button>

              {speechError && <p className="mt-3 text-xs text-center text-rose-600">{speechError}</p>}
            </div>
          </div>
        ) : (
          <div className="border-t bg-gray-50 p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 mb-3">
              <span className="truncate">{statusText}</span>
            </div>

            <div className="flex justify-center space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isMicMuted ? "bg-red-100 text-red-600" : isListening ? "bg-green-100 text-green-600 animate-pulse" : "bg-gray-100"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? <MicOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Mic className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"}`}
                onClick={toggleCamera}
              >
                {isCameraOff ? <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Camera className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"}`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? <Volume2 className="h-6 w-6 sm:h-5 sm:w-5" /> : <VolumeX className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-14 w-14 sm:h-12 sm:w-12 bg-red-600 hover:bg-red-700 text-white touch-manipulation"
                onClick={endCall}
              >
                <Phone className="h-6 w-6 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* DEBUG PANEL */}
        {debugEnabled && (
          <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-black/70 p-2 text-[10px] text-white">
            <div className="mb-1 flex items-center justify-between">
              <div className="font-semibold">debug</div>
              <button className="opacity-80 hover:opacity-100" onClick={() => setDebugLines([])}>
                clear
              </button>
            </div>
            <div className="max-h-[140px] overflow-auto whitespace-pre-wrap leading-snug">
              {debugLines.length ? debugLines.join("\n") : "no logs yet"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
