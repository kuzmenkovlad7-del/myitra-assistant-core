"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  idleVideo?: string
  speakingVideo?: string
}

const AI_CHARACTERS: AICharacter[] = [
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description: "Senior psychologist specializing in CBT with 15+ years of experience.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
  },
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description: "Clinical psychologist specializing in anxiety, depression and work stress.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description: "Psychotherapist specializing in emotional regulation, trauma and relationships.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
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

function cleanResponseText(text: string): string {
  if (!text) return ""
  if (text.startsWith('[{"output":')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed[0]?.output) return String(parsed[0].output).trim()
    } catch {}
  }
  return text.replace(/\n\n/g, " ").replace(/\*\*/g, "").replace(/```/g, "").replace(/[\n\r]/g, " ").trim()
}

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (first.output || first.response || first.text || first.message || first.content || first.result || "").toString().trim()
  }
  if (typeof data === "object") {
    return (data.output || data.response || data.text || data.message || data.content || data.result || "").toString().trim()
  }
  return ""
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
  const hasEnhancedVideo = !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // ВАЖНО: стартуем с МИКРОФОНОМ ВЫКЛЮЧЕННЫМ. Доступ запрашиваем ТОЛЬКО по кнопке 🎤
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(true) // чтобы камера не мешала разрешениям микрофона на мобилке
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [activityStatus, setActivityStatus] = useState<"listening" | "thinking" | "speaking">("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [interimTranscript, setInterimTranscript] = useState("")

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const micStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])

  const recognitionRef = useRef<any>(null)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(true)

  // mobile audio unlock (фикс TypeScript null + iOS autoplay)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  const unlockMobileAudio = useCallback(async () => {
    if (audioUnlocked) return
    if (typeof window === "undefined") return

    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx()
        const ctx = audioCtxRef.current
        if (ctx?.state === "suspended") {
          await ctx.resume().catch(() => {})
        }
      }

      // короткий “тихий” звук для разблокировки
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      )
      a.muted = true
      a.playsInline = true
      await a.play().catch(() => {})
      a.pause()
      setAudioUnlocked(true)
    } catch {
      // если не получилось — не блокируем UI
      setAudioUnlocked(true)
    }
  }, [audioUnlocked])

  const stopCurrentSpeech = useCallback(() => {
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
  }, [])

  const getRefinedVoiceForLanguage = useCallback(
    (langCode: string, preferredGender: "female" | "male" = "female"): SpeechSynthesisVoice | null => {
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

      cache.set(cacheKey, voices[0]!)
      return voices[0]!
    },
    [nativeVoicePreferences, selectedCharacter.id]
  )

  const browserSpeak = useCallback(
    (text: string, gender: "male" | "female", onDone: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return onDone()

      try {
        window.speechSynthesis.cancel()
      } catch {}

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = currentLocale

      const voice = getRefinedVoiceForLanguage(activeLanguage.code, gender)
      if (voice) utterance.voice = voice

      const speechParams = getNativeSpeechParameters(activeLanguage.code, gender)
      utterance.rate = speechParams.rate
      utterance.pitch = speechParams.pitch
      utterance.volume = speechParams.volume

      currentUtteranceRef.current = utterance
      utterance.onend = () => onDone()
      utterance.onerror = () => onDone()

      try {
        window.speechSynthesis.speak(utterance)
      } catch {
        onDone()
      }
    },
    [activeLanguage.code, currentLocale, getRefinedVoiceForLanguage]
  )

  const safeGenerateGoogleTTS = useCallback(async (text: string, locale: string, gender: "male" | "female") => {
    const fn: any = generateGoogleTTS as any
    if (typeof fn !== "function") return null

    try {
      // Поддержка разных сигнатур без ключей в клиенте.
      if (fn.length >= 3) return await fn(text, locale, gender)
      if (fn.length === 2) return await fn(text, locale)
      return await fn(text)
    } catch {
      return null
    }
  }, [])

  const speakText = useCallback(
    async (text: string) => {
      if (!isCallActiveRef.current) return
      if (!isSoundEnabled) return

      const cleaned = cleanResponseText(text)
      if (!cleaned) return

      await unlockMobileAudio()
      stopCurrentSpeech()

      setIsAiSpeaking(true)
      setActivityStatus("speaking")

      if (hasEnhancedVideo && speakingVideoRef.current && selectedCharacter.speakingVideo) {
        try {
          speakingVideoRef.current.currentTime = 0
          await speakingVideoRef.current.play()
        } catch {}
      }

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
        else setActivityStatus("listening")
      }

      try {
        const gender: "male" | "female" = selectedCharacter.gender || "female"

        if (shouldUseGoogleTTS(activeLanguage.code)) {
          const audioDataUrl = await safeGenerateGoogleTTS(cleaned, currentLocale, gender)
          if (audioDataUrl) {
            await new Promise<void>((resolve) => {
              const audio = new Audio()
              currentAudioRef.current = audio
              audio.preload = "auto"
              audio.volume = 1
              audio.crossOrigin = "anonymous"
              audio.playsInline = true
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
          await new Promise<void>((resolve) => browserSpeak(cleaned, selectedCharacter.gender, resolve))
        }
      } finally {
        finish()
      }
    },
    [
      activeLanguage.code,
      browserSpeak,
      currentLocale,
      hasEnhancedVideo,
      isSoundEnabled,
      safeGenerateGoogleTTS,
      selectedCharacter.gender,
      selectedCharacter.idleVideo,
      selectedCharacter.speakingVideo,
      stopCurrentSpeech,
      unlockMobileAudio,
    ]
  )

  const handleUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (!isCallActiveRef.current) return

      setMessages((prev) => [...prev, { id: prev.length + 1, role: "user", text: trimmed }])
      setActivityStatus("thinking")
      setSpeechError(null)

      try {
        if (!VIDEO_ASSISTANT_WEBHOOK_URL) throw new Error("VIDEO_ASSISTANT_WEBHOOK_URL is not configured")

        const res = await fetch(VIDEO_ASSISTANT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            language: activeLanguage.code,
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
      } catch (e: any) {
        const msg = t("I couldn't process your message. Could you try again?")
        setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: msg }])
        if (onError && e instanceof Error) onError(e)
      } finally {
        if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
        else setActivityStatus("listening")
      }
    },
    [activeLanguage.code, onError, selectedCharacter.gender, selectedCharacter.id, speakText, t, user?.email]
  )

  const ensureMicrophoneStream = useCallback(async () => {
    if (typeof window === "undefined") return null

    if (!window.isSecureContext) {
      throw new Error("INSECURE_CONTEXT")
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("NO_GUM")
    }

    // если уже есть поток — используем его
    if (micStreamRef.current && micStreamRef.current.getTracks().some((t) => t.readyState === "live")) {
      return micStreamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    micStreamRef.current = stream
    return stream
  }, [])

  const stopMicrophoneStream = useCallback(() => {
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
      } catch {}
      micStreamRef.current = null
    }
  }, [])

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript("")
  }, [])

  const startWebSpeechRecognition = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return false

    stopSpeechRecognition()

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = currentLocale

    recognition.onstart = () => {
      setIsListening(true)
      setActivityStatus("listening")
      setSpeechError(null)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      let interim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript || ""
        if (!text) continue

        if (result.isFinal) finalTranscript += text + " "
        else interim += text
      }

      if (interim) setInterimTranscript(interim)

      if (finalTranscript.trim()) {
        const txt = finalTranscript.trim()
        setInterimTranscript("")
        // не ждём “конца”, сразу отправляем
        handleUserText(txt)
      }
    }

    recognition.onerror = (event: any) => {
      // ВАЖНО: не путаем “нет speech api” и “нет разрешения”
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setSpeechError(
          t("Microphone access is blocked. Open site settings and allow microphone, then tap the mic again.")
        )
        setIsMicMuted(true)
        stopSpeechRecognition()
        return
      }
      if (event?.error === "audio-capture") {
        setSpeechError(t("Could not capture audio. Try reconnecting the microphone or reloading the page."))
        return
      }
      // no-speech и aborted — не считаем фаталом
    }

    recognition.onend = () => {
      // На мобилке recognition часто сам завершает сессию — делаем мягкий автоперезапуск
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        try {
          recognition.start()
        } catch {
          // если не стартует — пусть юзер нажмёт 🎤 снова
          setIsListening(false)
        }
      } else {
        setIsListening(false)
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      return true
    } catch {
      return false
    }
  }, [currentLocale, handleUserText, stopSpeechRecognition, t])

  const stopRecorder = useCallback(() => {
    if (recorderRef.current) {
      try {
        recorderRef.current.stop()
      } catch {}
      recorderRef.current = null
    }
    setIsRecording(false)
  }, [])

  const transcribeViaApi = useCallback(async (blob: Blob) => {
    const fd = new FormData()
    // универсальное имя/тип — бэкенд пусть сам решает
    fd.append("file", blob, "audio.webm")
    fd.append("language", activeLanguage.code)

    const res = await fetch("/api/stt", { method: "POST", body: fd })
    const ct = res.headers.get("content-type") || ""
    if (!res.ok) throw new Error(`STT_${res.status}`)

    if (ct.includes("application/json")) {
      const data = await res.json()
      return (data.text || data.transcript || data.result || data.output || "").toString().trim()
    }
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return (data.text || data.transcript || data.result || data.output || "").toString().trim()
    } catch {
      return text.trim()
    }
  }, [activeLanguage.code])

  const startRecorder = useCallback(async () => {
    recordedChunksRef.current = []
    setSpeechError(null)

    const stream = await ensureMicrophoneStream()
    if (!stream) return false

    if (typeof MediaRecorder === "undefined") {
      setSpeechError(t("Voice recording is not supported on this device/browser. Please use chat input."))
      return false
    }

    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]
    const mimeType = preferred.find((m) => (MediaRecorder as any).isTypeSupported?.(m)) || ""

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data)
    }

    recorder.onstart = () => {
      setIsRecording(true)
      setIsListening(true)
      setActivityStatus("listening")
    }

    recorder.onerror = () => {
      setSpeechError(t("Recording error. Please try again."))
      setIsRecording(false)
      setIsListening(false)
    }

    recorder.onstop = async () => {
      setIsRecording(false)
      setIsListening(false)
      setInterimTranscript("")

      const chunks = recordedChunksRef.current
      recordedChunksRef.current = []
      if (!chunks.length) return

      try {
        setActivityStatus("thinking")
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" })
        const text = await transcribeViaApi(blob)
        if (text) await handleUserText(text)
        else setSpeechError(t("Could not recognize speech. Please try again."))
      } catch {
        setSpeechError(t("Could not recognize speech. Please try again."))
      } finally {
        if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
        else setActivityStatus("listening")
      }
    }

    recorderRef.current = recorder

    try {
      recorder.start(250)
      return true
    } catch {
      recorderRef.current = null
      setSpeechError(t("Could not start recording. Please try again."))
      return false
    }
  }, [ensureMicrophoneStream, handleUserText, t, transcribeViaApi])

  const toggleMicrophone = useCallback(async () => {
    if (!isCallActiveRef.current) return

    // включаем микрофон
    if (isMicMutedRef.current) {
      setSpeechError(null)
      setInterimTranscript("")
      await unlockMobileAudio()

      try {
        await ensureMicrophoneStream()

        setIsMicMuted(false)
        isMicMutedRef.current = false

        const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
        if (hasWebSpeech) {
          const ok = await startWebSpeechRecognition()
          // если webspeech внезапно не стартует — fallback в рекордер
          if (!ok) {
            await startRecorder()
          }
        } else {
          // iOS/Safari: нет speech API -> recorder -> /api/stt
          await startRecorder()
        }
      } catch (e: any) {
        setIsMicMuted(true)
        isMicMutedRef.current = true
        stopSpeechRecognition()
        stopRecorder()
        stopMicrophoneStream()

        if (e?.message === "INSECURE_CONTEXT") {
          setSpeechError(t("Microphone works only on HTTPS. Open the site via secure URL (https://)."))
        } else {
          setSpeechError(
            t("Microphone access is blocked. Open site settings and allow microphone, then tap the mic again.")
          )
        }
      }

      return
    }

    // выключаем микрофон
    setIsMicMuted(true)
    isMicMutedRef.current = true

    // webspeech stop
    stopSpeechRecognition()

    // recorder stop (после stop будет транскрибирование и отправка)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      stopRecorder()
      return
    }

    // если recorder не использовался — просто глушим поток
    stopMicrophoneStream()
  }, [
    ensureMicrophoneStream,
    startRecorder,
    startWebSpeechRecognition,
    stopMicrophoneStream,
    stopRecorder,
    stopSpeechRecognition,
    unlockMobileAudio,
    t,
  ])

  const toggleCamera = useCallback(async () => {
    if (!isCallActiveRef.current) return

    // включаем
    if (isCameraOff) {
      setSpeechError(null)
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("NO_GUM")
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (userVideoRef.current) userVideoRef.current.srcObject = stream
        setIsCameraOff(false)
      } catch {
        setSpeechError(t("Camera access is blocked. Allow camera in site settings."))
        setIsCameraOff(true)
      }
      return
    }

    // выключаем
    setIsCameraOff(true)
    if (userVideoRef.current?.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      userVideoRef.current.srcObject = null
    }
  }, [isCameraOff, t])

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      stopCurrentSpeech()
      setIsAiSpeaking(false)
    }
  }, [isSoundEnabled, stopCurrentSpeech])

  const startCall = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)

    setSpeechError(null)
    setInterimTranscript("")
    setMessages([])
    setIsAiSpeaking(false)

    setIsCallActive(true)
    isCallActiveRef.current = true

    setIsMicMuted(true)
    isMicMutedRef.current = true

    setActivityStatus("listening")

    await unlockMobileAudio()

    if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
      try {
        idleVideoRef.current.currentTime = 0
        idleVideoRef.current.play().catch(() => {})
      } catch {}
    }

    setIsConnecting(false)
  }, [hasEnhancedVideo, isConnecting, selectedCharacter.idleVideo, unlockMobileAudio])

  const endCall = useCallback(() => {
    setIsCallActive(false)
    isCallActiveRef.current = false

    setIsMicMuted(true)
    isMicMutedRef.current = true

    stopSpeechRecognition()
    stopRecorder()
    stopMicrophoneStream()
    stopCurrentSpeech()

    setIsListening(false)
    setIsRecording(false)
    setInterimTranscript("")
    setSpeechError(null)
    setMessages([])

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
      stream.getTracks().forEach((t) => t.stop())
      userVideoRef.current.srcObject = null
    }
  }, [stopMicrophoneStream, stopCurrentSpeech, stopRecorder, stopSpeechRecognition])

  // close modal => end call
  useEffect(() => {
    if (!isOpen && isCallActiveRef.current) endCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and start the video call.")
    if (isAiSpeaking) return t("Assistant is speaking.")
    if (!isMicMuted && (isListening || isRecording)) return t("Listening…")
    return t("Microphone is off. Tap 🎤 to speak.")
  })()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] sm:max-h-[860px] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <div className="font-semibold text-base sm:text-lg truncate">{t("Video call with AI-psychologist")}</div>
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
            className="text-white hover:bg-white/10 min-w-[44px] min-h-[44px]"
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
                              selectedCharacter.id === character.id
                                ? "bg-primary-600 text-white"
                                : "bg-gray-100 text-gray-700"
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

              {speechError && (
                <div className="max-w-md mx-auto w-full bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
                  {speechError}
                </div>
              )}
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
                      {t("Tap the mic button to speak. On iOS it will record voice and transcribe.")}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter.name}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    )
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
                  isMicMuted ? "bg-red-100 text-red-600" : isRecording || isListening ? "bg-green-100 text-green-600 animate-pulse" : "bg-gray-100"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? <MicOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Mic className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isCameraOff ? "bg-gray-100" : "bg-green-100 text-green-700"
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
