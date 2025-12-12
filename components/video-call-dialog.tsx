// @ts-nocheck
"use client"

import { useState, useEffect, useRef } from "react"
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
  Sparkles,
  Brain,
} from "lucide-react"
import Image from "next/image"
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

const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}

const VIDEO_CALL_VOICE_CONFIGS = {
  uk: {
    female: {
      languageCode: "uk-UA",
      name: "uk-UA-Standard-A",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar",
      ssmlGender: "MALE",
    },
  },
  ru: {
    female: {
      languageCode: "ru-RU",
      name: "ru-RU-Standard-A",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "ru-RU",
      name: "ru-RU-Standard-B",
      ssmlGender: "MALE",
    },
  },
  en: {
    female: {
      languageCode: "en-US",
      name: "en-US-Neural2-F",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "en-US",
      name: "en-US-Neural2-D",
      ssmlGender: "MALE",
    },
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
    description:
      "Старший психолог, специализирующийся на когнитивно-поведенческой терапии, с опытом более 15 лет.",
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
    description:
      "Клинический психолог, специализирующийся на тревоге, депрессии и стрессе на работе.",
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
    description:
      "Психотерапевт, специализирующийся на эмоциональной регуляции, работе с травмой и отношениях.",
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
    AudioContext?: any
    webkitAudioContext?: any
    speechSynthesis?: SpeechSynthesis
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

export default function VideoCallDialog({
  isOpen,
  onClose,
  openAiApiKey,
  onError,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const activeLanguage =
    currentLanguage || ({ code: "en", name: "English", flag: "🇺🇸" } as any)

  const languageDisplayName =
    activeLanguage.name ||
    (activeLanguage.code === "uk"
      ? "Ukrainian"
      : activeLanguage.code === "ru"
      ? "Russian"
      : "English")

  const currentLocale = getLocaleForLanguage(activeLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(
    AI_CHARACTERS[1] || AI_CHARACTERS[0],
  )

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<
    "listening" | "thinking" | "speaking"
  >("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")

  const recognitionRef = useRef<any>(null)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const lastSpeechActivityRef = useRef<number | null>(null)
  const recognitionStopReasonRef = useRef<"none" | "manual" | "finalResult">(
    "none",
  )
  const isAiSpeakingRef = useRef(false)
  const micStreamRef = useRef<MediaStream | null>(null)

  const AUTO_MUTE_AFTER_MS = 15 * 60 * 1000 // 15 минут тишины до авто-отключения

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  // preload voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const load = () => {
      const voices = window.speechSynthesis!.getVoices()
      if (voices.length) {
        getRefinedVoiceForLanguage(activeLanguage.code, "female")
        getRefinedVoiceForLanguage(activeLanguage.code, "male")
      }
    }
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load)
    }
  })

  // camera PIP
  useEffect(() => {
    if (isCallActive && !isCameraOff && userVideoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
        })
        .catch(() => {
          setIsCameraOff(true)
        })
    }

    return () => {
      const videoEl = userVideoRef.current
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        videoEl.srcObject = null
      }
    }
  }, [isCallActive, isCameraOff])

  // close modal -> стоп звонок
  useEffect(() => {
    if (!isOpen && isCallActive) {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // ----- явный запрос доступа к микрофону (особенно важен на мобилках) -----
  async function requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === "undefined") {
      setSpeechError(
        t(
          "Microphone access is not available in this environment. Please open the assistant in a regular browser window.",
        ),
      )
      return false
    }

    const hasMediaDevices =
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function"

    if (!hasMediaDevices) {
      setSpeechError(
        t(
          "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
        ),
      )
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })

      // держим стрим открытым на время звонка (важно для iOS/Safari)
      micStreamRef.current = stream
      setSpeechError(null)
      return true
    } catch (error: any) {
      console.log("[Video] getUserMedia error:", error)
      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setSpeechError(
          t(
            "Microphone is blocked in the browser. Please allow access in the site permissions and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setSpeechError(
          t("No microphone was found on this device. Please check your hardware."),
        )
      } else {
        setSpeechError(
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }

      return false
    }
  }

  function cleanResponseText(text: string): string {
    if (!text) return ""

    if (text.startsWith('[{"output":')) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) {
          return String(parsed[0].output).trim()
        }
      } catch {
        // ignore
      }
    }

    return text
      .replace(/\n\n/g, " ")
      .replace(/\*\*/g, "")
      .replace(/```/g, "")
      .replace(/[\n\r]/g, " ")
      .trim()
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

  function getRefinedVoiceForLanguage(
    langCode: string,
    preferredGender: "female" | "male" = "female",
  ): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null

    const cacheKey = `${langCode}-${preferredGender}-${selectedCharacter.id}`
    const cache = voiceCacheRef.current
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!
    }

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    const nativeList =
      nativeVoicePreferences[langCode]?.[preferredGender] || []

    for (const name of nativeList) {
      const v = voices.find((voice) => voice.name === name)
      if (v) {
        cache.set(cacheKey, v)
        return v
      }
    }

    const langVoices = voices.filter((v) =>
      v.lang.toLowerCase().startsWith(langCode.toLowerCase()),
    )
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

  function browserSpeak(
    text: string,
    gender: "male" | "female",
    onDone: () => void,
  ) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onDone()
      return
    }

    try {
      window.speechSynthesis.cancel()
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = currentLocale

    const voice = getRefinedVoiceForLanguage(activeLanguage.code, gender)
    if (voice) {
      utterance.voice = voice
    }

    const speechParams = getNativeSpeechParameters(
      activeLanguage.code,
      gender,
    )
    utterance.rate = speechParams.rate
    utterance.pitch = speechParams.pitch
    utterance.volume = speechParams.volume

    currentUtteranceRef.current = utterance

    utterance.onend = () => {
      onDone()
    }
    utterance.onerror = () => {
      onDone()
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      onDone()
    }
  }

  async function speakText(text: string): Promise<void> {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return
    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    // на всякий случай глушим распознавание, чтобы ассистент не слушал сам себя
    stopSpeechRecognition()

    stopCurrentSpeech()

    setIsAiSpeaking(true)
    isAiSpeakingRef.current = true
    setActivityStatus("speaking")

    if (
      hasEnhancedVideo &&
      speakingVideoRef.current &&
      selectedCharacter.speakingVideo
    ) {
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

      if (
        hasEnhancedVideo &&
        idleVideoRef.current &&
        selectedCharacter.idleVideo &&
        isCallActiveRef.current
      ) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
      }
    }

    try {
      if (shouldUseGoogleTTS(activeLanguage.code)) {
        try {
          const audioDataUrl = await generateGoogleTTS(
            cleaned,
            currentLocale,
            gender,
            VIDEO_CALL_GOOGLE_TTS_CREDENTIALS,
            VIDEO_CALL_VOICE_CONFIGS,
          )

          if (!audioDataUrl) {
            throw new Error("No audio from Google TTS")
          }

          await new Promise<void>((resolve) => {
            const audio = new Audio()
            currentAudioRef.current = audio
            audio.preload = "auto"
            audio.volume = 1
            audio.playsInline = true
            audio.crossOrigin = "anonymous"
            audio.src = audioDataUrl
            audio.onended = () => {
              resolve()
            }
            audio.onerror = () => {
              resolve()
            }
            audio
              .play()
              .then(() => {})
              .catch(() => resolve())
          })
        } catch (e) {
          await new Promise<void>((resolve) => {
            browserSpeak(cleaned, gender, resolve)
          })
        }
      } else {
        await new Promise<void>((resolve) => {
          browserSpeak(cleaned, gender, resolve)
        })
      }
    } finally {
      finish()
    }
  }

  async function handleUserText(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: trimmed },
    ])
    setActivityStatus("thinking")
    setSpeechError(null)

    try {
      const langForBackend =
        activeLanguage.code?.startsWith("uk") ||
        activeLanguage.code?.startsWith("ru") ||
        activeLanguage.code?.startsWith("en")
          ? activeLanguage.code
          : activeLanguage.code || "uk"

      if (!VIDEO_ASSISTANT_WEBHOOK_URL) {
        throw new Error("VIDEO_ASSISTANT_WEBHOOK_URL is not configured")
      }

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

      if (!res.ok) {
        throw new Error(`Webhook error: ${res.status}`)
      }

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // string
      }

      const aiRaw = extractAnswer(data)
      const cleaned = cleanResponseText(aiRaw)

      if (!cleaned) {
        throw new Error("Empty response received")
      }

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: cleaned },
      ])

      await speakText(cleaned)
    } catch (error: any) {
      console.error("Video assistant error:", error)
      let errorMessage = ""
      if (error?.name === "AbortError") {
        errorMessage = t("Connection timeout. Please try again.")
      } else if (error?.message === "Empty response received") {
        errorMessage = t(
          "I received your message but couldn't generate a response. Could you try rephrasing?",
        )
      } else if (error?.message === "VIDEO_ASSISTANT_WEBHOOK_URL is not configured") {
        errorMessage = t(
          "The video assistant is temporarily unavailable. Please contact support.",
        )
      } else {
        errorMessage = t(
          "I couldn't process your message. Could you try again?",
        )
      }

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: errorMessage },
      ])

      if (onError && error instanceof Error) {
        onError(error)
      }
    } finally {
      if (isCallActiveRef.current && !isMicMutedRef.current && !isAiSpeakingRef.current) {
        startSpeechRecognition()
      } else if (!isCallActiveRef.current) {
        setActivityStatus("listening")
      }
    }
  }

  function startSpeechRecognition() {
    if (typeof window === "undefined") return
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

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
    recognitionStopReasonRef.current = "none"

    recognition.onstart = () => {
      setIsListening(true)
      setSpeechError(null)
      setActivityStatus("listening")
      if (!lastSpeechActivityRef.current) {
        lastSpeechActivityRef.current = Date.now()
      }
    }

    recognition.onresult = (event: any) => {
      if (isAiSpeakingRef.current) {
        // игнорируем результаты, пока ассистент говорит сам
        return
      }

      let finalTranscript = ""
      let interim = ""
      let hadAnySpeech = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript || ""
        if (!text) continue

        hadAnySpeech = true

        if (result.isFinal) {
          finalTranscript += text + " "
        } else {
          interim += text
        }
      }

      if (hadAnySpeech) {
        lastSpeechActivityRef.current = Date.now()
      }

      if (interim) {
        setInterimTranscript(interim)
      }

      if (finalTranscript.trim()) {
        const text = finalTranscript.trim()
        setInterimTranscript("")
        recognitionStopReasonRef.current = "finalResult"
        try {
          recognition.stop()
        } catch {}
        setIsListening(false)
        handleUserText(text)
      }
    }

    recognition.onerror = (event: any) => {
      console.log("Speech recognition error:", event)

      if (event.error === "not-allowed") {
        setSpeechError(
          t(
            "Microphone access was blocked. Please allow it in your browser settings and restart the call.",
          ),
        )
        setIsMicMuted(true)
        isMicMutedRef.current = true
        setActivityStatus("listening")
        return
      }

      if (event.error === "service-not-allowed") {
        setSpeechError(
          t(
            "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
          ),
        )
        setIsMicMuted(true)
        isMicMutedRef.current = true
        setActivityStatus("listening")
        return
      }

      if (event.error === "audio-capture") {
        setSpeechError(t("Error while listening. Please try again."))
        setActivityStatus("listening")
        return
      }

      if (event.error === "no-speech") {
        return
      }

      setSpeechError(t("Error while listening. Please try again."))
      setActivityStatus("listening")
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)

      if (
        recognitionStopReasonRef.current === "none" &&
        isCallActiveRef.current &&
        !isMicMutedRef.current
      ) {
        const now = Date.now()
        const lastActivity = lastSpeechActivityRef.current ?? now
        if (!lastSpeechActivityRef.current) {
          lastSpeechActivityRef.current = now
        }
        const inactiveFor = now - lastActivity

        if (inactiveFor < AUTO_MUTE_AFTER_MS) {
          try {
            recognitionStopReasonRef.current = "none"
            recognition.start()
            recognitionRef.current = recognition
            setIsListening(true)
          } catch (err) {
            console.log("Error auto-restarting recognition:", err)
          }
        } else {
          setIsMicMuted(true)
          isMicMutedRef.current = true
        }
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (error) {
      console.log("Error starting recognition:", error)
    }
  }

  function stopSpeechRecognition() {
    if (recognitionRef.current) {
      recognitionStopReasonRef.current = "manual"
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  async function startCall() {
    setIsConnecting(true)
    setSpeechError(null)

    try {
      const micOk = await requestMicrophoneAccess()
      if (!micOk) {
        setIsConnecting(false)
        return
      }

      setIsCallActive(true)
      isCallActiveRef.current = true

      setMessages([])
      setInterimTranscript("")
      setIsMicMuted(false)
      isMicMutedRef.current = false
      lastSpeechActivityRef.current = Date.now()
      recognitionStopReasonRef.current = "none"

      if (
        hasEnhancedVideo &&
        idleVideoRef.current &&
        selectedCharacter.idleVideo
      ) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      startSpeechRecognition()
    } catch (error: any) {
      console.error("Failed to start call:", error)
      setSpeechError(
        error?.message ||
          t(
            "Failed to start the call. Please check your microphone and camera permissions.",
          ),
      )
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
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)
    lastSpeechActivityRef.current = null
    recognitionStopReasonRef.current = "manual"

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

    if (userVideoRef.current?.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      userVideoRef.current.srcObject = null
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      micStreamRef.current = null
    }
  }

  function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    if (isMicMuted) {
      setIsMicMuted(false)
      isMicMutedRef.current = false
      lastSpeechActivityRef.current = Date.now()
      recognitionStopReasonRef.current = "none"
      setSpeechError(null)
      startSpeechRecognition()
    } else {
      setIsMicMuted(true)
      isMicMutedRef.current = true
      stopSpeechRecognition()
      setInterimTranscript("")
    }
  }

  function toggleCamera() {
    if (isCameraOff) {
      setIsCameraOff(false)
    } else {
      setIsCameraOff(true)
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
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

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted && isListening

  const statusText = (() => {
    if (!isCallActive)
      return t(
        "Choose an AI psychologist and press “Start video call” to begin.",
      )
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (micOn) return t("Listening… you can speak.")
    return t("Paused. Turn on microphone to continue.")
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="flex h-[620px] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10 sm:h-[700px]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-4 py-3 text-white sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              {t("Video session with AI-psychologist")}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-indigo-100">
              <span className="truncate">
                {t("Video session in {{language}}", {
                  language: languageDisplayName,
                })}
              </span>
              <span className="ml-1">{activeLanguage.flag}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              endCall()
              onClose()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white shadow-sm hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {!isCallActive ? (
            // PRE-CALL SCREEN
            <div className="flex h-full flex-col items-center">
              <div className="mb-4 w-full max-w-xl text-center sm:mb-6">
                <h3 className="mb-2 text-lg font-semibold sm:text-2xl">
                  {t("Choose Your AI Psychologist")}
                </h3>
                <p className="text-sm text-gray-600 sm:text-base">
                  {t(
                    "Select the AI psychologist you'd like to speak with during your video call.",
                  )}
                </p>
              </div>

              <div className="mb-5 w-full max-w-md rounded-2xl bg-blue-50 px-4 py-3 text-center sm:mb-6">
                <p className="mb-1 text-xs font-medium text-blue-700">
                  {t("Video call language")}:
                </p>
                <div className="flex items-center justify-center text-sm font-semibold text-blue-900 sm:text-base">
                  <span className="mr-2 text-lg">{activeLanguage.flag}</span>
                  {languageDisplayName}
                </div>
              </div>

              <div className="w-full max-w-4xl flex-1 overflow-y-auto px-1 sm:px-2">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {AI_CHARACTERS.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => setSelectedCharacter(character)}
                      className={`relative flex h-full flex-col rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                        selectedCharacter.id === character.id
                          ? "border-indigo-500"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex h-full flex-col p-3 sm:p-4">
                        <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
                          {character.idleVideo ? (
                            <video
                              className="absolute inset-0 h-full w-full scale-[1.08] object-cover"
                              muted
                              loop
                              playsInline
                              autoPlay
                              preload="auto"
                            >
                              <source
                                src={character.idleVideo}
                                type="video/mp4"
                              />
                            </video>
                          ) : (
                            <Image
                              src={character.avatar || "/placeholder.svg"}
                              alt={character.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
                            />
                          )}
                        </div>
                        <h4 className="mb-1 text-center text-xs font-semibold text-slate-900 sm:text-sm">
                          {character.name}
                        </h4>
                        <p className="mb-3 text-center text-[10px] text-slate-600 sm:text-xs">
                          {character.description}
                        </p>
                        <div className="mt-auto text-center">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-medium sm:text-xs ${
                              selectedCharacter.id === character.id
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {selectedCharacter.id === character.id
                              ? t("Selected")
                              : t("Select")}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 w-full max-w-md px-1 sm:mt-5">
                <Button
                  className="h-12 w-full rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:h-14 sm:text-base"
                  onClick={startCall}
                  disabled={isConnecting}
                >
                  {isConnecting ? t("Connecting...") : t("Start Video Call")}
                </Button>
                {speechError && (
                  <p className="mt-3 text-center text-xs text-rose-600">
                    {speechError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // IN-CALL SCREEN
            <div className="flex h-full flex-col gap-3 sm:flex-row sm:gap-4">
              {/* LEFT: VIDEO */}
              <div className="flex w-full flex-col sm:w-2/3">
                <div className="relative w-full flex-1 overflow-hidden rounded-2xl bg-white">
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
                            <source
                              src={selectedCharacter.idleVideo}
                              type="video/mp4"
                            />
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
                            <source
                              src={selectedCharacter.speakingVideo}
                              type="video/mp4"
                            />
                          </video>
                        )}
                      </>
                    ) : (
                      <>
                        {selectedCharacter && !isAiSpeaking && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <div className="relative h-40 w-40 sm:h-56 sm:w-56">
                              <Image
                                src={
                                  selectedCharacter.avatar || "/placeholder.svg"
                                }
                                alt={selectedCharacter.name}
                                fill
                                className="rounded-full object-cover"
                                sizes="224px"
                              />
                            </div>
                          </div>
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
                            <source
                              src={selectedCharacter.speakingVideo}
                              type="video/mp4"
                            />
                          </video>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-medium sm:right-4 sm:top-4 sm:text-xs ${
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
                      : t("Speaking...")}
                  </div>

                  {!isCameraOff && (
                    <div className="absolute bottom-2 right-2 h-20 w-20 overflow-hidden rounded-xl bg-gray-800 shadow-lg sm:bottom-4 sm:right-4 sm:h-32 sm:w-32">
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full scale-x-[-1] object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: CHAT */}
              <div className="flex w-full flex-col overflow-hidden rounded-2xl border bg-gray-50 sm:w-1/3">
                <div className="flex items-center gap-2 border-b px-3 py-2 sm:px-4 sm:py-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <Brain className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-800">
                      {selectedCharacter.name}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {statusText}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-xs sm:space-y-4 sm:px-4 sm:py-4 sm:text-sm">
                  {messages.length === 0 && (
                    <div className="rounded-2xl bg-indigo-50/80 p-3 text-slate-800 sm:p-4">
                      {t(
                        "You can start speaking when you're ready. The assistant will answer with voice and text here.",
                      )}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-2 text-slate-900 sm:px-3.5 sm:py-2.5"
                      >
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-2 text-slate-900 sm:px-3.5 sm:py-2.5"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter.name}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ),
                  )}

                  {interimTranscript && (
                    <div className="rounded-lg bg-gray-50 p-3 text-[11px] italic text-gray-500 sm:text-xs">
                      {interimTranscript}...
                    </div>
                  )}

                  {speechError && (
                    <div className="rounded-lg bg-rose-50 p-3 text-[11px] text-rose-700 sm:text-xs">
                      {speechError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM BAR */}
        {isCallActive && (
          <div className="border-t bg-gray-50 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                <Sparkles className="h-3 w-3" />
                {statusText}
              </div>
            </div>

            <div className="flex justify-center space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                size="icon"
                className={`h-14 w-14 rounded-full touch-manipulation sm:h-12 sm:w-12 ${
                  isMicMuted
                    ? "bg-red-100 text-red-600"
                    : micOn
                    ? "bg-green-100 text-green-600 animate-pulse"
                    : "bg-gray-100"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? (
                  <MicOff className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <Mic className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`h-14 w-14 rounded-full touch-manipulation sm:h-12 sm:w-12 ${
                  isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"
                }`}
                onClick={toggleCamera}
              >
                {isCameraOff ? (
                  <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <Camera className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`h-14 w-14 rounded-full touch-manipulation sm:h-12 sm:w-12 ${
                  isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"
                }`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? (
                  <Volume2 className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <VolumeX className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full bg-red-600 text-white hover:bg-red-700 touch-manipulation sm:h-12 sm:w-12"
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
