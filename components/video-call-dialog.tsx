"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { X, Mic, MicOff, Camera, CameraOff, Phone, Volume2, VolumeX, Brain } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { getLocaleForLanguage, getNativeSpeechParameters, getNativeVoicePreferences } from "@/lib/i18n/translation-utils"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

const STT_ENDPOINT = "/api/stt"

// локальные конфиги (если у тебя в generateGoogleTTS разные сигнатуры — ниже есть safeGenerateGoogleTTS)
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

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

function isProbablyIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS13Plus = ua.includes("Macintosh") && "ontouchend" in document
  return iOS || iPadOS13Plus
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

export default function VideoCallDialog({ isOpen, onClose, openAiApiKey, onError }: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const activeLanguage = currentLanguage || ({ code: "en", name: "English", flag: "🇺🇸" } as any)
  const languageDisplayName =
    activeLanguage.name ||
    (activeLanguage.code === "uk" ? "Ukrainian" : activeLanguage.code === "ru" ? "Russian" : "English")

  const currentLocale = getLocaleForLanguage(activeLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(AI_CHARACTERS[1] || AI_CHARACTERS[0])

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(true) // стартуем с MUTE — как “голосовой”
  const [isCameraOff, setIsCameraOff] = useState(true) // на мобилках безопаснее включать по кнопке
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<"listening" | "thinking" | "speaking">("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")

  // speech recognition
  const recognitionRef = useRef<any>(null)

  // iOS fallback recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<BlobPart[]>([])
  const recordStreamRef = useRef<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  // video/audio refs
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(true)

  const supportsWebSpeech = useMemo(() => {
    if (typeof window === "undefined") return false
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [])

  const supportsMediaRecorder = useMemo(() => {
    if (typeof window === "undefined") return false
    return !!(navigator.mediaDevices?.getUserMedia && (window as any).MediaRecorder)
  }, [])

  const hasEnhancedVideo = !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  // voices preload
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const load = () => {
      try {
        window.speechSynthesis.getVoices()
      } catch {}
    }
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load)
    }
  }, [])

  // close modal -> stop call
  useEffect(() => {
    if (!isOpen && isCallActive) endCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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

  function getRefinedVoiceForLanguage(langCode: string, preferredGender: "female" | "male" = "female") {
    if (typeof window === "undefined" || !window.speechSynthesis) return null

    const cacheKey = `${langCode}-${preferredGender}-${selectedCharacter.id}`
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

  // iOS/Android: unlock audio after user gesture (чтобы TTS потом играл без сюрпризов)
  async function unlockMobileAudioOnce() {
    try {
      // silent audio trick
      const a = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/jQwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
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

  // ключевое: прогреть разрешение микрофона внутри user-gesture
  async function warmupMicrophonePermission(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(t("Your browser does not support microphone access."))
    }
    if (!window.isSecureContext) {
      throw new Error(t("Microphone requires HTTPS. Open the site via https://"))
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    // сразу закрываем — нам нужен был только prompt и grant
    stream.getTracks().forEach((tr) => tr.stop())
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

  async function speakText(text: string) {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    stopCurrentSpeech()

    setIsAiSpeaking(true)
    setActivityStatus("speaking")

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

      if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
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
    } finally {
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        // если webspeech — перезапускаем
        if (supportsWebSpeech) startSpeechRecognition()
      } else {
        setActivityStatus("listening")
      }
    }
  }

  function stopSpeechRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  function startSpeechRecognition() {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = currentLocale

    recognition.onstart = () => {
      setIsListening(true)
      setSpeechError(null)
      setActivityStatus("listening")
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      let interim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const txt = result[0]?.transcript || ""
        if (!txt) continue
        if (result.isFinal) finalTranscript += txt + " "
        else interim += txt
      }

      if (interim) setInterimTranscript(interim)

      if (finalTranscript.trim()) {
        const txt = finalTranscript.trim()
        setInterimTranscript("")
        try {
          recognition.stop()
        } catch {}
        setIsListening(false)
        handleUserText(txt)
      }
    }

    recognition.onerror = (event: any) => {
      console.log("Speech recognition error:", event)
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setSpeechError(
          t("Microphone access is blocked. Please allow microphone permission in the browser (site settings) and try again."),
        )
        setIsMicMuted(true)
        isMicMutedRef.current = true
        stopSpeechRecognition()
        return
      }

      if (event?.error === "audio-capture") {
        setSpeechError(t("Cannot capture audio from microphone. Check that another app is not using it."))
        return
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)

      // авто-рефреш для Android/Chrome, если не muted
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        try {
          recognition.start()
          recognitionRef.current = recognition
          setIsListening(true)
        } catch {}
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (err) {
      console.log("Error starting recognition:", err)
      setSpeechError(t("Could not start voice recognition. Please try again."))
    }
  }

  async function transcribeBlobViaApi(blob: Blob): Promise<string> {
    const fd = new FormData()
    // имя файла и mime важны для некоторых STT
    const filename = blob.type.includes("mp4") ? "speech.mp4" : "speech.webm"
    fd.append("audio", blob, filename)
    fd.append("language", activeLanguage.code || "uk")
    fd.append("locale", currentLocale)

    const res = await fetch(STT_ENDPOINT, { method: "POST", body: fd })
    if (!res.ok) throw new Error(`STT error: ${res.status}`)
    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
      const data: any = await res.json()
      return (data.text || data.transcript || data.result || data.output || "").toString().trim()
    }
    const txt = (await res.text()).trim()
    // иногда API возвращает plain text
    return txt
  }

  async function startRecordingFallback() {
    if (!supportsMediaRecorder) {
      setSpeechError(t("Voice recording is not supported on this device. Please use text input."))
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream

      const mimeType = pickBestRecorderMimeType()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      recordChunksRef.current = []
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        setIsRecording(false)
        setIsListening(false)

        try {
          const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" })
          recordChunksRef.current = []

          // закрываем stream
          if (recordStreamRef.current) {
            recordStreamRef.current.getTracks().forEach((t) => t.stop())
            recordStreamRef.current = null
          }

          setActivityStatus("thinking")
          const text = await transcribeBlobViaApi(blob)
          if (!text) {
            setSpeechError(t("I couldn't recognize the speech. Please try again."))
            setActivityStatus("listening")
            return
          }

          setSpeechError(null)
          await handleUserText(text)
        } catch (e: any) {
          console.error("STT fallback failed:", e)
          setSpeechError(t("Speech recognition failed. Please try again or use text."))
          setActivityStatus("listening")
        }
      }

      mediaRecorderRef.current = mr
      mr.start()
      setIsRecording(true)
      setIsListening(true)
      setActivityStatus("listening")
      setSpeechError(null)
    } catch (e: any) {
      console.error("startRecordingFallback error:", e)
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        setSpeechError(t("Microphone access is blocked. Please allow microphone permission in the browser settings."))
      } else {
        setSpeechError(t("Unable to access microphone."))
      }
    }
  }

  function stopRecordingFallback() {
    try {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== "inactive") mr.stop()
    } catch {}
    mediaRecorderRef.current = null
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
      setIsMicMuted(true)
      isMicMutedRef.current = true
      setIsListening(false)
      setActivityStatus("listening")

      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      // важное: прогреть микрофон на клике "Start video call"
      await warmupMicrophonePermission()

      // iOS: webspeech обычно отсутствует → мы не стартуем слушание автоматически,
      // пользователь нажимает микрофон и мы пишем через MediaRecorder.
      if (!supportsWebSpeech && isProbablyIOS()) {
        setSpeechError(t("On iOS voice recognition may be limited in the browser. Use the microphone button to record a message."))
      }
    } catch (e: any) {
      console.error("startCall error:", e)
      setSpeechError(e?.message || t("Microphone access is blocked. Please allow permission and retry."))
      // откатываем call, чтобы не висеть в полусостоянии
      setIsCallActive(false)
      isCallActiveRef.current = false
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopSpeechRecognition()
    stopRecordingFallback()
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)
    setIsMicMuted(true)
    isMicMutedRef.current = true
    setIsListening(false)
    setIsRecording(false)

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
    if (recordStreamRef.current) {
      recordStreamRef.current.getTracks().forEach((t) => t.stop())
      recordStreamRef.current = null
    }
  }

  async function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    // включаем микрофон
    if (isMicMuted) {
      try {
        await warmupMicrophonePermission()
      } catch (e: any) {
        setSpeechError(e?.message || t("Microphone access is blocked. Please allow permission and retry."))
        return
      }

      setSpeechError(null)
      setIsMicMuted(false)
      isMicMutedRef.current = false

      // webspeech
      if (supportsWebSpeech) {
        setIsListening(true)
        setActivityStatus("listening")
        startSpeechRecognition()
        return
      }

      // fallback (iOS Safari)
      await startRecordingFallback()
      return
    }

    // выключаем микрофон
    setIsMicMuted(true)
    isMicMutedRef.current = true
    setInterimTranscript("")
    setIsListening(false)

    if (supportsWebSpeech) {
      stopSpeechRecognition()
      return
    }

    stopRecordingFallback()
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
    }
  }

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (!supportsWebSpeech && isRecording) return t("Recording… Tap mic again to send.")
    if (!isMicMuted && isListening) return t("Listening… you can speak.")
    return t("Paused. Turn on microphone to continue.")
  })()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] sm:max-h-[860px] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center relative bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              {t("Video call with AI-psychologist")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
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
            className="text-white hover:bg-indigo-500/60 min-w-[44px] min-h-[44px] flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
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

              {/* LANGUAGE CARD (без доп. текста снизу) */}
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
                            <video
                              className="absolute inset-0 w-full h-full object-cover scale-[1.08]"
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
                    {activityStatus === "listening" ? t("Listening...") : activityStatus === "thinking" ? t("Thinking...") : t("Assistant is speaking...")}
                  </div>

                  {!isCameraOff && (
                    <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-20 sm:w-40 aspect-video bg-gray-800 rounded overflow-hidden shadow-lg">
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform scale-x-[-1]"
                      />
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

                  {interimTranscript && (
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
                  isMicMuted
                    ? "bg-red-100 text-red-600"
                    : supportsWebSpeech
                    ? isListening
                      ? "bg-green-100 text-green-600 animate-pulse"
                      : "bg-gray-100"
                    : isRecording
                    ? "bg-green-100 text-green-600 animate-pulse"
                    : "bg-gray-100"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? <MicOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Mic className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"
                }`}
                onClick={toggleCamera}
              >
                {isCameraOff ? <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Camera className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"
                }`}
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
      </div>
    </div>
  )
}
