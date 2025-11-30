// components/video-call-dialog.tsx
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
  User,
  Sparkles,
  Brain,
} from "lucide-react"
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"
import { APP_NAME } from "@/lib/app-config"

// URL вебхука для видео-ассистента.
// Приоритет:
// 1) NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL
// 2) NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL
// 3) /api/turbotaai-agent (дефолт, как в .env у тебя сейчас)
const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

// Креды для Google TTS — в твоём проекте реальные подставляются на сервере.
// Здесь оставляем заглушку, чтобы фронт не ломался.
const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}

// Конфиги под разные языки (сейчас кастом под uk-UA, можно расширять)
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
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  voice: string
  animated?: boolean
  speakingVideo?: string
  idleVideo?: string
  speakingVideoNew?: string
}

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
    speechSynthesis?: SpeechSynthesis
  }
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey: string // оставляем для совместимости, не используем
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

// Одна базовая София
const defaultCharacter: AICharacter = {
  id: "dr-sophia",
  name: "Dr. Sophia",
  gender: "female",
  description:
    "Clinical psychologist specializing in anxiety, depression, and workplace stress management",
  avatar:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
  voice: "en-US-JennyNeural",
  animated: true,
  idleVideo:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
  speakingVideoNew:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
  speakingVideo:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG111211_6034-6fD2w1l0V94iXV7x4VeGW74NHbtZrk.MP4",
}

// Универсальный парсер ответа от n8n (как в voice-call-dialog)
function extractAnswer(data: any): string {
  if (!data) return ""

  if (typeof data === "string") {
    return data.trim()
  }

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

  const effectiveEmail = user?.email || "guest@example.com"

  const [selectedCharacter] = useState<AICharacter>(defaultCharacter)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [activityStatus, setActivityStatus] =
    useState<"listening" | "thinking" | "speaking">("listening")

  const [currentVideoState, setCurrentVideoState] =
    useState<"idle" | "speaking">("idle")

  const recognitionRef = useRef<any | null>(null)
  const isRecognitionActiveRef = useRef(false)
  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideoNew

  // автоскролл диалога
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // язык для SpeechRecognition / TTS
  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  // ---------- управление SpeechRecognition (ровно как в voice-call-dialog) ----------

  function ensureRecognitionRunning() {
    if (typeof window === "undefined") return

    const shouldListen =
      isCallActiveRef.current &&
      !isMicMutedRef.current &&
      !isAiSpeakingRef.current

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!shouldListen) {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      isRecognitionActiveRef.current = false
      setIsListening(false)
      return
    }

    if (!SR) {
      setSpeechError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

    let recognition = recognitionRef.current

    if (!recognition) {
      recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = true
      recognitionRef.current = recognition

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true
        setIsListening(true)
        setActivityStatus("listening")
        setNetworkError(null)
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event)
        if (event?.error !== "no-speech") {
          setNetworkError(t("Error while listening. Please try again."))
        }
      }

      recognition.onend = () => {
        isRecognitionActiveRef.current = false
        setIsListening(false)

        // если всё ещё нужно слушать — перезапускаем
        setTimeout(() => {
          const stillShouldListen =
            isCallActiveRef.current &&
            !isMicMutedRef.current &&
            !isAiSpeakingRef.current

          if (stillShouldListen) {
            ensureRecognitionRunning()
          }
        }, 300)
      }

      recognition.onresult = (event: any) => {
        // если ассистент говорит — игнорируем, чтобы не слушать его озвучку
        if (isAiSpeakingRef.current) return

        let finalText = ""
        let interim = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          const transcript = res[0]?.transcript ?? ""
          if (!transcript) continue

          if (res.isFinal) finalText += transcript
          else interim += transcript
        }

        if (interim) {
          setInterimTranscript(interim)
        } else {
          setInterimTranscript("")
        }

        const text = finalText.trim()
        if (!text) return

        const userMsg: ChatMessage = {
          id: Date.now(),
          role: "user",
          text,
        }

        setMessages((prev) => [...prev, userMsg])
        void handleUserText(text)
      }
    }

    recognition.lang = computeLangCode()

    if (!isRecognitionActiveRef.current) {
      try {
        recognition.start()
      } catch (e: any) {
        if (e?.name !== "InvalidStateError") {
          console.error("Cannot start recognition", e)
          setNetworkError(
            t("Could not start microphone. Check permissions and try again."),
          )
        }
      }
    }
  }

  function hardStopRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
    }
    isRecognitionActiveRef.current = false
    setIsListening(false)
  }

  function stopEverything() {
    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsListening(false)
    setIsCameraOff(false)
    setIsSoundEnabled(true)
    setActivityStatus("listening")
    setCurrentVideoState("idle")
    setNetworkError(null)
    setSpeechError(null)
    setMessages([])
    setInterimTranscript("")

    hardStopRecognition()

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (idleVideoRef.current) {
      idleVideoRef.current.pause()
      idleVideoRef.current.currentTime = 0
    }
    if (speakingVideoRef.current) {
      speakingVideoRef.current.pause()
      speakingVideoRef.current.currentTime = 0
    }

    if (userVideoRef.current && userVideoRef.current.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      userVideoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- озвучка ответа (Google TTS → браузерный TTS) ----------

  async function speakText(text: string) {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleanText = text?.toString().trim()
    if (!cleanText) return

    // выключаем распознавание на время озвучки
    isAiSpeakingRef.current = true
    setIsAiSpeaking(true)
    setActivityStatus("speaking")
    setCurrentVideoState("speaking")
    ensureRecognitionRunning()

    // стопаем прошлую озвучку
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    const finish = () => {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)
      setCurrentVideoState("idle")
      setActivityStatus("listening")
      ensureRecognitionRunning()
    }

    try {
      const langCode =
        typeof (currentLanguage as any) === "string"
          ? ((currentLanguage as any) as string)
          : (currentLanguage as any)?.code || "uk"

      // пробуем Google TTS, если включен для этого языка
      if (shouldUseGoogleTTS(langCode)) {
        try {
          const audioDataUrl = await generateGoogleTTS(
            cleanText,
            langCode,
            selectedCharacter.gender || "female",
            VIDEO_CALL_GOOGLE_TTS_CREDENTIALS,
            VIDEO_CALL_VOICE_CONFIGS,
          )

          if (audioDataUrl) {
            const audio = new Audio()
            audioRef.current = audio
            audio.src = audioDataUrl
            audio.preload = "auto"
            audio.volume = 1
            audio.playsInline = true
            audio.setAttribute("playsinline", "true")

            audio.onended = () => {
              finish()
            }
            audio.onerror = () => {
              finish()
            }

            try {
              await audio.play()
              return
            } catch (e) {
              console.error("Google TTS play error:", e)
              // упадём в fallback
            }
          }
        } catch (e) {
          console.error("Google TTS error:", e)
        }
      }

      // fallback — браузерный TTS
      if (typeof window === "undefined" || !window.speechSynthesis) {
        finish()
        return
      }

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = computeLangCode()
      utterance.rate = 1
      utterance.pitch = 1

      utterance.onend = () => {
        finish()
      }
      utterance.onerror = () => {
        finish()
      }

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.error("speakText error:", e)
      finish()
    }
  }

  // ---------- отправка текста в n8n / OpenAI (как в voice-call-dialog, но mode: "video") ----------

  async function handleUserText(text: string) {
    if (!isCallActiveRef.current) return

    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      VIDEO_ASSISTANT_WEBHOOK_URL.trim() || "/api/turbotaai-agent"

    try {
      setActivityStatus("thinking")
      setNetworkError(null)

      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: lang,
          email: effectiveEmail,
          mode: "video",
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
        // не JSON — строка
      }

      console.log("Video raw response:", data)

      let answer = extractAnswer(data)

      if (!answer) {
        answer = t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )
      }

      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        text: answer,
      }

      setMessages((prev) => [...prev, assistantMsg])
      setActivityStatus("listening")
      speakText(answer)
    } catch (error: any) {
      console.error("Video call error:", error)
      setNetworkError(t("Connection error. Please try again."))
      setActivityStatus("listening")
      if (onError && error instanceof Error) onError(error)
    }
  }

  // ---------- камера ----------

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
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
    }
  }, [isCallActive, isCameraOff])

  function toggleCamera() {
    if (isCameraOff) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
          setIsCameraOff(false)
        })
        .catch(() => {
          alert(
            t(
              "Could not access your camera. Please check your permissions.",
            ),
          )
        })
    } else {
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
      setIsCameraOff(true)
    }
  }

  function toggleSound() {
    setIsSoundEnabled((prev) => {
      const next = !prev

      if (!next) {
        // выключили звук — обрубаем текущую озвучку
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel()
        }
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        setCurrentVideoState("idle")
        ensureRecognitionRunning()
      }

      return next
    })
  }

  function toggleMicrophone() {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next
    ensureRecognitionRunning()
  }

  // ---------- управление звонком ----------

  async function startCall() {
    setIsConnecting(true)
    setSpeechError(null)
    setNetworkError(null)

    try {
      isCallActiveRef.current = true
      isMicMutedRef.current = false
      isAiSpeakingRef.current = false

      setIsCallActive(true)
      setIsMicMuted(false)
      setIsAiSpeaking(false)
      setActivityStatus("listening")
      setMessages([])
      setInterimTranscript("")
      setCurrentVideoState("idle")

      ensureRecognitionRunning()

      if (hasEnhancedVideo && selectedCharacter.idleVideo) {
        setTimeout(() => {
          if (idleVideoRef.current && isCallActiveRef.current) {
            idleVideoRef.current.currentTime = 0
            idleVideoRef.current.play().catch(() => {})
          }
        }, 500)
      }
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
    stopEverything()
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col h-[100dvh] sm:h-[90vh] max-h-none sm:max-h-[800px] overflow-hidden">
        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center rounded-t-xl relative bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              {t("AI Psychologist Video Call")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
              {t("Video session in {{language}}", {
                language: languageDisplayName,
              })}{" "}
              · {activeLanguage.flag}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 mr-2">
            <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
              {APP_NAME} · {t("Video assistant online")}
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

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col touch-pan-y">
          {!isCallActive ? (
            // Экран до начала звонка
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-6 sm:mb-8 px-2">
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">
                  {t("Choose Your AI Psychologist")}
                </h3>
                <p className="text-sm sm:text-base text-gray-1000 max-w-md mx-auto">
                  {t(
                    "Select the AI psychologist you'd like to speak with during your video call.",
                  )}
                </p>
              </div>

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center mx-2">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  {t("Video call language")}:
                </p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{activeLanguage.flag}</span>
                  {languageDisplayName}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {shouldUseGoogleTTS(activeLanguage.code)
                    ? t(
                        "All characters use Google TTS for authentic native Ukrainian accent",
                      )
                    : t(
                        "AI will understand and respond in this language with native accent",
                      )}
                </p>
              </div>

              <div className="w-full max-w-md px-2">
                <div className="relative bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 border-primary-600">
                  <div className="relative w-full aspect-square mb-3 sm:mb-4 overflow-hidden rounded-lg">
                    <Image
                      src={selectedCharacter.avatar || "/placeholder.svg"}
                      alt={selectedCharacter.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      priority
                    />
                  </div>
                  <h4 className="font-semibold text-base sm:text-lg text-center mb-1 sm:mb-2">
                    {selectedCharacter.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 sm:mb-4">
                    {selectedCharacter.description}
                  </p>
                  <div className="text-center text-xs text-primary-700 font-medium">
                    {t("Selected")}
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 w-full max-w-md px-2">
                <Button
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-base sm:text-lg py-4 sm:py-6 min-h-[56px]"
                  onClick={startCall}
                  disabled={isConnecting}
                >
                  {isConnecting ? t("Connecting...") : t("Start Video Call")}
                </Button>
                {speechError && (
                  <p className="mt-3 text-xs text-center text-rose-600">
                    {speechError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Экран во время звонка
            <div className="flex-1 flex flex-col">
              {/* Видео-плеер */}
              <div className="relative w-full aspect-video sm:aspect-[16/10] bg-black rounded-lg overflow-hidden mb-3 sm:mb-4">
                <div className="absolute inset-0">
                  {hasEnhancedVideo ? (
                    <>
                      {selectedCharacter?.idleVideo && (
                        <video
                          ref={idleVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.06] ${
                            currentVideoState === "idle"
                              ? "opacity-100"
                              : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source
                            src={selectedCharacter.idleVideo}
                            type="video/mp4"
                          />
                        </video>
                      )}

                      {selectedCharacter?.speakingVideoNew && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.06] ${
                            currentVideoState === "speaking"
                              ? "opacity-100"
                              : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source
                            src={selectedCharacter.speakingVideoNew}
                            type="video/mp4"
                          />
                        </video>
                      )}
                    </>
                  ) : (
                    <>
                      {selectedCharacter && !isAiSpeaking && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-64 h-64 relative">
                            <Image
                              src={
                                selectedCharacter.avatar || "/placeholder.svg"
                              }
                              alt={selectedCharacter.name}
                              fill
                              className="object-cover rounded-full scale-[1.02]"
                              sizes="256px"
                            />
                          </div>
                        </div>
                      )}

                      {selectedCharacter?.speakingVideo && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.02] ${
                            isAiSpeaking ? "opacity-100" : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
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
                    : shouldUseGoogleTTS(activeLanguage.code)
                    ? t("Speaking with Google TTS...")
                    : t("Speaking...")}
                </div>

                {!isCameraOff && (
                  <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-20 sm:w-1/4 aspect-video bg-gray-800 rounded overflow-hidden shadow-lg">
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

              {/* Чат */}
              <div
                ref={scrollRef}
                className="flex-1 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto touch-pan-y"
              >
                <div className="space-y-3 sm:space-y-4">
                  {messages.length === 0 && (
                    <div className="bg-primary-50 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm text-slate-800">
                      {t(
                        "You can start speaking when you're ready. The assistant will answer with voice and text here.",
                      )}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-blue-800">
                          <User className="h-3.5 w-3.5" />
                          {t("You said")}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter?.name || t("AI Psychologist")}
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

                  {networkError && (
                    <div className="bg-rose-50 rounded-lg p-3 text-xs sm:text-sm text-rose-700 break-words">
                      {networkError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* БОТТОМ-ПАНЕЛЬ */}
        {isCallActive && (
          <div className="p-3 sm:p-4 border-t bg-gray-50 flex flex-col safe-area-bottom">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                <Sparkles className="h-3 w-3" />
                {statusText}
              </div>
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
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
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
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
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
