"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Phone,
  Volume2,
  VolumeX,
  Brain,
  Video as VideoIcon,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import {
  getLocaleForLanguage,
  getNativeSpeechParameters,
  getNativeVoicePreferences,
} from "@/lib/i18n/translation-utils"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

const STT_ENDPOINT = "/api/stt"

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
  if (m.includes("mp4")) return "speech.mp4"
  if (m.includes("aac")) return "speech.aac"
  if (m.includes("mpeg") || m.includes("mp3")) return "speech.mp3"
  return "speech.webm"
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

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.output ||
      first.response ||
      first.text ||
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
      data.output ||
      data.response ||
      data.text ||
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

export default function VideoCallDialog({ isOpen, onClose, onError }: VideoCallDialogProps) {
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

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [activityStatus, setActivityStatus] = useState<"paused" | "listening" | "thinking" | "speaking">("paused")
  const [speechError, setSpeechError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])

  // streams/recorder
  const avStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recorderMimeRef = useRef<string>("audio/webm")
  const audioChunksRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)

  // video/audio refs
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)

  const hasEnhancedVideo = !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
    if (!isCallActiveRef.current) return
    if (isMicMuted) setActivityStatus("paused")
    else setActivityStatus("listening")
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

  useEffect(() => {
    if (!isOpen && isCallActive) endCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function computeShortLang(): string {
    const code = String(activeLanguage.code || "uk").toLowerCase()
    if (code.startsWith("uk") || code.startsWith("ua")) return "uk"
    if (code.startsWith("ru")) return "ru"
    if (code.startsWith("en")) return "en"
    return "uk"
  }

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

  async function unlockMobileAudioOnce() {
    try {
      const a = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/jQwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
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

  function pauseMicCapture() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === "recording") {
      try {
        rec.pause()
      } catch {}
    }
  }

  function resumeMicCapture() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return

    const rec = mediaRecorderRef.current
    if (rec && rec.state === "paused") {
      try {
        rec.resume()
      } catch {}
    }
  }

  async function maybeSendStt() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return
    if (isSttBusyRef.current) return
    if (!audioChunksRef.current.length) return

    const chunks = audioChunksRef.current
    audioChunksRef.current = []

    try {
      isSttBusyRef.current = true

      const mime = recorderMimeRef.current || "audio/webm"
      const blob = new Blob(chunks, { type: mime })
      if (blob.size < 8000) return

      const fd = new FormData()
      fd.append("audio", blob, filenameForMime(mime))
      fd.append("language", computeShortLang())

      const res = await fetch(STT_ENDPOINT, { method: "POST", body: fd })
      const raw = await res.text()

      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.success === false) {
        console.error("[STT] error:", res.status, raw)
        setSpeechError(t("Speech recognition failed. Please try again."))
        return
      }

      const text = String(data.text || "").trim()
      if (!text) return

      await handleUserText(text)
    } catch (e: any) {
      console.error("[STT] fatal:", e)
      setSpeechError(t("Speech recognition failed. Please try again."))
    } finally {
      isSttBusyRef.current = false
      if (audioChunksRef.current.length) void maybeSendStt()
    }
  }

  async function startAVAndRecorder() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("Your browser does not support microphone/camera access."))
    if (!window.isSecureContext) throw new Error(t("Microphone requires HTTPS. Open the site via https://"))
    if (typeof window !== "undefined" && !(window as any).MediaRecorder) throw new Error(t("Voice recording is not supported on this device/browser."))

    // 1 запрос — и камера, и микрофон
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" } as any,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any,
    })

    avStreamRef.current = stream

    // camera preview
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = stream
    }

    // recorder только по аудио-трекам
    const audioTracks = stream.getAudioTracks()
    const audioStream = new MediaStream(audioTracks)

    const mimeType = pickBestRecorderMimeType()
    const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream)

    mediaRecorderRef.current = recorder
    recorderMimeRef.current = recorder.mimeType || mimeType || "audio/webm"
    audioChunksRef.current = []
    isSttBusyRef.current = false

    recorder.onstart = () => {
      setSpeechError(null)
      setActivityStatus(isMicMutedRef.current ? "paused" : "listening")
    }

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data)
        void maybeSendStt()
      }
    }

    recorder.onerror = (e: any) => {
      console.error("[Recorder] error", e)
      setSpeechError(t("Speech recognition failed. Please try again."))
    }

    recorder.start(3500)
  }

  function stopAVAndRecorder() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null

    if (avStreamRef.current) {
      avStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      avStreamRef.current = null
    }

    if (userVideoRef.current) {
      try {
        userVideoRef.current.srcObject = null
      } catch {}
    }

    audioChunksRef.current = []
    isSttBusyRef.current = false
  }

  async function speakText(text: string) {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    stopCurrentSpeech()

    setIsAiSpeaking(true)
    setActivityStatus("speaking")

    // пока ассистент говорит — не записываем микрофон
    pauseMicCapture()

    if (hasEnhancedVideo && speakingVideoRef.current && selectedCharacter.speakingVideo) {
      try {
        speakingVideoRef.current.currentTime = 0
        await speakingVideoRef.current.play()
      } catch {}
    }

    const gender: "male" | "female" = selectedCharacter.gender || "female"

    const finish = () => {
      setIsAiSpeaking(false)

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

      // после речи — продолжаем запись, если микрофон не muted
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
        resumeMicCapture()
      } else {
        setActivityStatus("paused")
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
    const trimmed = text.trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    setMessages((prev) => [...prev, { id: prev.length + 1, role: "user", text: trimmed }])
    setActivityStatus("thinking")
    setSpeechError(null)

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

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      const aiRaw = extractAnswer(data)
      const cleaned = cleanResponseText(aiRaw)
      if (!cleaned) throw new Error("Empty response received")

      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: cleaned }])
      await speakText(cleaned)
    } catch (error: any) {
      console.error("Video assistant error:", error)
      const errorMessage = t("I couldn't process your message. Could you try again?")
      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: errorMessage }])
      if (onError && error instanceof Error) onError(error)
      setActivityStatus(isMicMutedRef.current ? "paused" : "listening")
      resumeMicCapture()
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
      setIsMicMuted(false)
      isMicMutedRef.current = false

      setIsCameraOff(false)
      setIsAiSpeaking(false)
      setActivityStatus("listening")

      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      await startAVAndRecorder()
    } catch (e: any) {
      console.error("startCall error:", e)
      setSpeechError(e?.message || t("Microphone access is blocked. Please allow permission and retry."))
      setIsCallActive(false)
      isCallActiveRef.current = false
      stopAVAndRecorder()
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopCurrentSpeech()
    stopAVAndRecorder()

    setIsAiSpeaking(false)
    setActivityStatus("paused")
    setMessages([])
    setSpeechError(null)
    setIsMicMuted(false)
    isMicMutedRef.current = false
    setIsCameraOff(false)

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
  }

  function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next

    // mute -> pause recorder
    if (next) {
      pauseMicCapture()
      setActivityStatus("paused")
      return
    }

    // unmute -> resume recorder
    setSpeechError(null)
    setActivityStatus(isAiSpeaking ? "speaking" : "listening")
    resumeMicCapture()
  }

  function toggleCamera() {
    if (!isCallActiveRef.current) return

    const stream = avStreamRef.current
    if (!stream) {
      setIsCameraOff(true)
      return
    }

    const videoTracks = stream.getVideoTracks()
    if (!videoTracks.length) {
      setIsCameraOff(true)
      return
    }

    const next = !isCameraOff
    setIsCameraOff(next)

    for (const tr of videoTracks) {
      try {
        tr.enabled = !next
      } catch {}
    }
  }

  function toggleSound() {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      stopCurrentSpeech()
      setIsAiSpeaking(false)
      if (isCallActiveRef.current) setActivityStatus(isMicMutedRef.current ? "paused" : "listening")
      resumeMicCapture()
    }
  }

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (isMicMuted) return t("Paused. Turn on microphone to continue.")
    return t("Listening… you can speak.")
  })()

  const badgeText =
    activityStatus === "listening"
      ? t("Listening...")
      : activityStatus === "thinking"
        ? t("Thinking...")
        : activityStatus === "speaking"
          ? t("Assistant is speaking...")
          : t("Paused")

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:h-[90vh] sm:max-h-[860px]">
        {/* HEADER */}
        <div className="relative flex items-center justify-between border-b bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 p-3 text-white sm:p-4">
          <div className="flex min-w-0 flex-1 flex-col pr-2">
            <h3 className="flex items-center gap-2 truncate text-base font-semibold sm:text-lg">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <VideoIcon className="h-4 w-4" />
              </span>
              {t("Video call with AI-psychologist")}
            </h3>
            <div className="mt-1 truncate text-xs text-indigo-100">
              {t("Video session in {{language}}", { language: languageDisplayName })} · {activeLanguage.flag}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              endCall()
              onClose()
            }}
            className="min-h-[44px] min-w-[44px] flex-shrink-0 rounded-full bg-white/10 text-white/90 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* MAIN */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 touch-pan-y overscroll-contain sm:p-4">
          {!isCallActive ? (
            <div className="flex flex-col gap-4">
              <div className="mt-1 text-center">
                <h3 className="mb-2 text-xl font-semibold sm:text-2xl">{t("Choose your AI psychologist")}</h3>
                <p className="mx-auto max-w-2xl text-sm text-gray-600 sm:text-base">
                  {t("Select the AI psychologist you'd like to speak with during your video call.")}
                </p>
              </div>

              <div className="mx-auto w-full max-w-md rounded-lg bg-blue-50 p-4 text-center">
                <p className="mb-1 text-sm font-medium text-blue-700">{t("Video call language")}:</p>
                <div className="flex items-center justify-center text-lg font-semibold text-blue-800">
                  <span className="mr-2">{activeLanguage.flag}</span>
                  {languageDisplayName}
                </div>
              </div>

              <div className="mx-auto w-full max-w-5xl">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {AI_CHARACTERS.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => setSelectedCharacter(character)}
                      className={`relative rounded-xl border-2 bg-white shadow-sm transition-shadow hover:shadow-md ${
                        selectedCharacter.id === character.id ? "border-primary-600" : "border-transparent"
                      }`}
                    >
                      <div className="flex h-full flex-col p-4 sm:p-5">
                        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-black">
                          {character.idleVideo ? (
                            <video
                              className="absolute inset-0 h-full w-full scale-[1.08] object-cover"
                              muted
                              loop
                              playsInline
                              autoPlay
                              preload="auto"
                            >
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

                        <h4 className="mb-1 text-center text-base font-semibold sm:text-lg">{character.name}</h4>
                        <p className="mb-3 text-center text-xs text-gray-600 sm:text-sm">{character.description}</p>

                        <div className="mt-auto text-center">
                          <span
                            className={`inline-flex rounded-full px-4 py-2 text-xs font-medium ${
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
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              {/* LEFT: VIDEO */}
              <div className="flex w-full flex-col sm:w-2/3">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-white sm:flex-1">
                  <div className="absolute inset-0 overflow-hidden bg-white">
                    {hasEnhancedVideo ? (
                      <>
                        {selectedCharacter.idleVideo && (
                          <video
                            ref={idleVideoRef}
                            className="absolute inset-0 h-full w-full scale-[1.08] object-cover"
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
                            className={`absolute inset-0 h-full w-full scale-[1.08] object-cover transition-opacity duration-700 ease-in-out ${
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
                        <div className="relative h-40 w-40 sm:h-56 sm:w-56">
                          <Image
                            src={selectedCharacter.avatar || "/placeholder.svg"}
                            alt={selectedCharacter.name}
                            fill
                            className="rounded-full object-cover"
                            sizes="224px"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={`absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium sm:right-4 sm:top-4 sm:px-3 sm:text-sm ${
                      activityStatus === "listening"
                        ? "bg-green-100 text-green-800"
                        : activityStatus === "thinking"
                          ? "bg-blue-100 text-blue-800"
                          : activityStatus === "speaking"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {badgeText}
                  </div>

                  {!isCameraOff && (
                    <div className="absolute bottom-2 right-2 w-20 overflow-hidden rounded bg-gray-800 shadow-lg sm:bottom-4 sm:right-4 sm:w-40">
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: CHAT */}
              <div className="flex w-full flex-col overflow-hidden rounded-lg border bg-gray-50 sm:w-1/3">
                <div className="flex items-center gap-2 border-b px-3 pb-2 pt-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <Brain className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate text-xs font-semibold text-slate-800">{selectedCharacter.name}</div>
                    <div className="truncate text-[11px] text-slate-500">{statusText}</div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                  {messages.length === 0 && (
                    <div className="rounded-2xl bg-primary-50 p-3 text-xs text-slate-800 sm:text-sm">
                      {t("You can start speaking when you're ready. The assistant will answer with voice and text here.")}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div key={msg.id} className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-3 text-xs text-slate-900 sm:text-sm">
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div key={msg.id} className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs text-slate-900 sm:text-sm">
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter.name}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ),
                  )}

                  {speechError && (
                    <div className="break-words rounded-lg bg-rose-50 p-3 text-xs text-rose-700 sm:text-sm">
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
          <div className="border-t bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:p-4">
            <div className="mx-auto max-w-md">
              <Button
                className="min-h-[56px] w-full bg-primary-600 py-5 text-base text-white hover:bg-primary-700 sm:text-lg"
                onClick={startCall}
                disabled={isConnecting}
              >
                {isConnecting ? t("Connecting...") : t("Start video call")}
              </Button>

              {speechError && <p className="mt-3 text-center text-xs text-rose-600">{speechError}</p>}
            </div>
          </div>
        ) : (
          <div className="border-t bg-gray-50 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
              <span className="truncate">{statusText}</span>
            </div>

            <div className="flex justify-center space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                size="icon"
                className={`h-14 w-14 touch-manipulation rounded-full sm:h-12 sm:w-12 ${
                  isMicMuted ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? <MicOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Mic className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`h-14 w-14 touch-manipulation rounded-full sm:h-12 sm:w-12 ${
                  isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"
                }`}
                onClick={toggleCamera}
              >
                {isCameraOff ? <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Camera className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`h-14 w-14 touch-manipulation rounded-full sm:h-12 sm:w-12 ${
                  isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"
                }`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? <Volume2 className="h-6 w-6 sm:h-5 sm:w-5" /> : <VolumeX className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 touch-manipulation rounded-full bg-red-600 text-white hover:bg-red-700 sm:h-12 sm:w-12"
                onClick={endCall}
              >
                <Phone className="h-6 w-6 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
