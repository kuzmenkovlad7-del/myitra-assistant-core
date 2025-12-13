"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { X, Mic, MicOff, Camera, CameraOff, Phone, Volume2, VolumeX, Brain, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { getLocaleForLanguage, getNativeSpeechParameters, getNativeVoicePreferences } from "@/lib/i18n/translation-utils"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

// если у тебя Google TTS на сервере — ключи НЕ должны быть в клиенте
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
  openAiApiKey?: string // ✅ делаем optional — фиксит ошибку компиляции app/page.tsx
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ]
  for (const t of candidates) {
    // @ts-ignore
    if (MediaRecorder.isTypeSupported?.(t)) return t
  }
  return undefined
}

function extractTextFromAny(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()
  if (Array.isArray(data)) {
    const first = data[0] ?? {}
    return (first.text || first.transcript || first.result || first.output || first.message || first.content || "")
      .toString()
      .trim()
  }
  if (typeof data === "object") {
    return (data.text || data.transcript || data.result || data.output || data.message || data.content || "")
      .toString()
      .trim()
  }
  return ""
}

export default function VideoCallDialog({ isOpen, onClose, openAiApiKey = "", onError }: VideoCallDialogProps) {
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

  // ✅ как в голосовом: стартуем звонок без авто-микрофона, юзер сам нажимает кнопку
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<"listening" | "thinking" | "speaking">("listening")
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

  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const monitorTimerRef = useRef<number | null>(null)
  const recordHardStopRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const heardSpeechRef = useRef(false)
  const silentForRef = useRef(0)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(true)

  const hasEnhancedVideo = !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  // camera
  useEffect(() => {
    if (!isCallActive || isCameraOff) return
    const el = userVideoRef.current
    if (!el) return

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (el) el.srcObject = stream
      })
      .catch(() => setIsCameraOff(true))

    return () => {
      const videoEl = el
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        videoEl.srcObject = null
      }
    }
  }, [isCallActive, isCameraOff])

  // close modal -> cleanup
  useEffect(() => {
    if (!isOpen && isCallActive) {
      endCall()
    }
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

  async function speakText(text: string) {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = (text || "").replace(/[\n\r]/g, " ").trim()
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

      // ✅ после речи НЕ автозапускаем микрофон — только если он включен пользователем
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
            ;(audio as any).playsInline = true
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
          // openAiApiKey тут не обязателен, оставляем для совместимости
          openAiApiKey,
        }),
      })

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      const aiText = extractTextFromAny(data)
      const cleaned = (aiText || "").replace(/[\n\r]/g, " ").trim()
      if (!cleaned) throw new Error("Empty response received")

      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: cleaned }])
      await speakText(cleaned)
    } catch (error: any) {
      console.error("Video assistant error:", error)
      const msg = t("I couldn't process your message. Could you try again?")
      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: msg }])
      if (onError && error instanceof Error) onError(error)
    } finally {
      if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
    }
  }

  async function ensureMicPermission(): Promise<MediaStream | null> {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setSpeechError(t("Your browser does not support microphone access."))
      return null
    }
    try {
      if (micStreamRef.current && micStreamRef.current.getTracks().some((t) => t.readyState === "live")) {
        return micStreamRef.current
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      micStreamRef.current = stream
      return stream
    } catch (e: any) {
      const name = e?.name || ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setSpeechError(
          t("Microphone access was blocked. Please allow it in browser settings (site permissions) and try again."),
        )
      } else if (name === "NotFoundError") {
        setSpeechError(t("No microphone found. Please connect a microphone and try again."))
      } else {
        setSpeechError(t("Unable to access microphone."))
      }
      return null
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

  function isSpeechRecognitionSupported() {
    if (typeof window === "undefined") return false
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  async function startSpeechRecognition() {
    const stream = await ensureMicPermission()
    if (!stream) return

    if (!isSpeechRecognitionSupported()) {
      // iOS Safari: нет Web Speech -> используем recorder fallback
      await startRecorderListening()
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    stopSpeechRecognition()

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = currentLocale

    recognition.onstart = () => {
      setIsListening(true)
      setActivityStatus("listening")
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
        try {
          recognition.stop()
        } catch {}
        setIsListening(false)
        handleUserText(txt)
      }
    }

    recognition.onerror = (event: any) => {
      if (event?.error === "not-allowed") {
        setSpeechError(
          t("Microphone access was blocked. Please allow it in browser settings (site permissions) and try again."),
        )
        setIsMicMuted(true)
        isMicMutedRef.current = true
        stopSpeechRecognition()
        return
      }
      if (event?.error === "no-speech") return
      setSpeechError(t("Error while listening. Please try again."))
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
      // ✅ перезапуск только если микрофон включен
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
      console.log("SpeechRecognition start error:", err)
      setSpeechError(t("Could not start voice recognition. Please try again."))
    }
  }

  async function transcribeBlob(blob: Blob): Promise<string> {
    try {
      const fd = new FormData()
      fd.append("file", blob, "speech.webm")
      fd.append("language", activeLanguage.code || "en")
      fd.append("locale", currentLocale)

      const res = await fetch("/api/stt", { method: "POST", body: fd })
      if (!res.ok) throw new Error(`STT error: ${res.status}`)

      const ct = res.headers.get("content-type") || ""
      if (ct.includes("application/json")) {
        const json = await res.json()
        return extractTextFromAny(json)
      }
      const txt = await res.text()
      try {
        return extractTextFromAny(JSON.parse(txt))
      } catch {
        return txt.trim()
      }
    } catch (e) {
      console.log("STT failed:", e)
      return ""
    }
  }

  function stopRecorderListening() {
    if (monitorTimerRef.current) {
      window.clearInterval(monitorTimerRef.current)
      monitorTimerRef.current = null
    }
    if (recordHardStopRef.current) {
      window.clearTimeout(recordHardStopRef.current)
      recordHardStopRef.current = null
    }
    analyserRef.current = null
    heardSpeechRef.current = false
    silentForRef.current = 0

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop()
      } catch {}
      mediaRecorderRef.current = null
    }
    setIsListening(false)
  }

  async function startRecorderListening() {
    const stream = await ensureMicPermission()
    if (!stream) return

    if (typeof MediaRecorder === "undefined") {
      setSpeechError(t("Voice input is not supported on this device/browser. Please use chat input."))
      setIsMicMuted(true)
      isMicMutedRef.current = true
      return
    }

    // если уже пишет — не стартуем второй раз
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") return

    chunksRef.current = []
    setSpeechError(null)
    setIsListening(true)
    setActivityStatus("listening")

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      recorder = new MediaRecorder(stream)
    }

    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      setIsListening(false)
      setInterimTranscript("")

      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" })
      chunksRef.current = []

      // если микрофон уже выключили/звонок закончили — не обрабатываем
      if (!isCallActiveRef.current || isMicMutedRef.current) return

      setActivityStatus("thinking")
      const text = await transcribeBlob(blob)
      const cleaned = (text || "").trim()

      if (!cleaned) {
        setActivityStatus("listening")
        return
      }

      await handleUserText(cleaned)
      if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
    }

    // silence detection (простая)
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx()
        if (audioCtxRef.current.state === "suspended") {
          // важно для iOS: resume в жесте
          await audioCtxRef.current.resume().catch(() => {})
        }

        const source = audioCtxRef.current.createMediaStreamSource(stream)
        const analyser = audioCtxRef.current.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        analyserRef.current = analyser

        const data = new Uint8Array(analyser.fftSize)
        heardSpeechRef.current = false
        silentForRef.current = 0

        const intervalMs = 120
        const threshold = 0.02 // подбирается, но работает стабильно для “старт/стоп по тишине”
        const stopAfterSilenceMs = 1200

        monitorTimerRef.current = window.setInterval(() => {
          if (!analyserRef.current) return
          analyserRef.current.getByteTimeDomainData(data)

          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)

          if (rms > threshold) {
            heardSpeechRef.current = true
            silentForRef.current = 0
          } else {
            if (heardSpeechRef.current) {
              silentForRef.current += intervalMs
              if (silentForRef.current >= stopAfterSilenceMs) {
                stopRecorderListening()
              }
            }
          }
        }, intervalMs)
      }
    } catch {}

    // hard stop (чтобы не писало бесконечно)
    recordHardStopRef.current = window.setTimeout(() => {
      stopRecorderListening()
    }, 20000)

    try {
      recorder.start(250) // небольшой timeslice
    } catch (e) {
      console.log("MediaRecorder start error:", e)
      setSpeechError(t("Could not start recording. Please try again."))
      setIsListening(false)
    }
  }

  function releaseMicStream() {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      micStreamRef.current = null
    }
  }

  function startCall() {
    if (isConnecting) return
    setIsConnecting(true)
    setSpeechError(null)

    setIsCallActive(true)
    isCallActiveRef.current = true

    setMessages([])
    setInterimTranscript("")
    setIsMicMuted(true) // ✅ как в голосовом
    isMicMutedRef.current = true
    setActivityStatus("listening")

    if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
      try {
        idleVideoRef.current.play().catch(() => {})
      } catch {}
    }

    setIsConnecting(false)
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopSpeechRecognition()
    stopRecorderListening()
    releaseMicStream()
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)

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
      stream.getTracks().forEach((track) => track.stop())
      userVideoRef.current.srcObject = null
    }
  }

  async function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    // включаем
    if (isMicMutedRef.current) {
      setSpeechError(null)
      setIsMicMuted(false)
      isMicMutedRef.current = false
      setActivityStatus("listening")

      // ✅ важный момент: сначала разрешение (getUserMedia), потом распознавание
      await startSpeechRecognition()
      return
    }

    // выключаем
    setIsMicMuted(true)
    isMicMutedRef.current = true
    setInterimTranscript("")
    stopSpeechRecognition()
    stopRecorderListening()
  }

  function toggleCamera() {
    if (isCameraOff) setIsCameraOff(false)
    else {
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
    }
  }

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (!isMicMuted) return t("Listening… you can speak.")
    return t("Microphone is off. Tap the mic button to speak.")
  })()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] sm:max-h-[860px] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
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

              {/* LANGUAGE CARD (без описания под языком) */}
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
                      {t("Tap the mic button and speak. The assistant will answer with voice and text here.")}
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
              <Sparkles className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{statusText}</span>
            </div>

            <div className="flex justify-center space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isMicMuted
                    ? "bg-red-100 text-red-600"
                    : isListening
                    ? "bg-green-100 text-green-600 animate-pulse"
                    : "bg-gray-100"
                }`}
                onClick={() => toggleMicrophone()}
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
