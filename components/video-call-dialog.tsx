"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  Mic,
  MicOff,
  Brain,
  Sparkles,
  Loader2,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { APP_NAME } from "@/lib/app-config"

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
}

type Message = {
  id: string
  from: "user" | "ai"
  text: string
}

const AI_AVATAR_URL =
  "https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=1600" // замени на свой файл, если нужно

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected")
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const recognitionRef = useRef<any | null>(null)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const userStreamRef = useRef<MediaStream | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // полный сброс: микрофон, озвучка, камера, сообщения
  const stopEverything = useCallback(() => {
    setIsCallActive(false)
    setIsConnecting(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsAiThinking(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setMessages([])

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((track) => track.stop())
      userStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen, stopEverything])

  // отправка текста в твой /api/chat → далее всё как в голосовом ассистенте
  const sendToAssistant = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean) return

      const userMessage: Message = {
        id: `${Date.now()}-user`,
        from: "user",
        text: clean,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsAiThinking(true)
      setNetworkError(null)

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: clean,
            language: currentLanguage.code,
            email: effectiveEmail,
            mode: "video", // можешь отличать в /api/chat логически
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const answer: string =
          (data && (data.text as string)) ||
          t("I'm sorry, I couldn't process your message. Could you try again?")

        const aiMessage: Message = {
          id: `${Date.now()}-ai`,
          from: "ai",
          text: answer,
        }

        setMessages((prev) => [...prev, aiMessage])
        speakText(answer)
      } catch (error: any) {
        console.error("Video call error:", error)
        setNetworkError(t("Connection error. Please try again."))
        if (onError && error instanceof Error) onError(error)
      } finally {
        setIsAiThinking(false)
      }
    },
    [currentLanguage.code, effectiveEmail, onError, t],
  )

  // озвучка ответа — во время TTS микрофон НЕ слушает
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return
      if (!text?.trim()) return

      // временно вырубаем распознавание, чтобы ассистент не слушал сам себя
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      setIsListening(false)
      setIsAiSpeaking(true)

      const utterance = new SpeechSynthesisUtterance(text)

      utterance.lang = currentLanguage.code.startsWith("uk")
        ? "uk-UA"
        : currentLanguage.code.startsWith("ru")
          ? "ru-RU"
          : "en-US"

      utterance.rate = 1
      utterance.pitch = 1

      const restartListeningIfNeeded = () => {
        setIsAiSpeaking(false)
        if (
          isCallActive &&
          !isMicMuted &&
          typeof window !== "undefined" &&
          !window.speechSynthesis.speaking
        ) {
          startRecognition()
        }
      }

      utterance.onend = restartListeningIfNeeded
      utterance.onerror = restartListeningIfNeeded

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    [currentLanguage.code, isCallActive, isMicMuted],
  )

  // запуск SpeechRecognition (слушаем только пользователя, не себя)
  const startRecognition = useCallback(() => {
    if (!isCallActive || isMicMuted) return
    if (typeof window === "undefined") return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setNetworkError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

    // если что-то висит — аккуратно останавливаем
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = currentLanguage.code.startsWith("uk")
      ? "uk-UA"
      : currentLanguage.code.startsWith("ru")
        ? "ru-RU"
        : "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setConnectionStatus("connected")
      setNetworkError(null)
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event)
      if (event?.error !== "no-speech") {
        setNetworkError(t("Error while listening. Please try again."))
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      // мягкий перезапуск: только если звонок активен, микрофон включен и ассистент сейчас не говорит
      if (
        isCallActive &&
        !isMicMuted &&
        typeof window !== "undefined" &&
        !window.speechSynthesis?.speaking
      ) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            console.error("Cannot restart recognition", e)
          }
        }, 350)
      }
    }

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text = last[0]?.transcript?.trim()
      if (!text) return

      void sendToAssistant(text)
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (e) {
      console.error("Cannot start recognition", e)
      setNetworkError(
        t("Could not start microphone. Check permissions and try again."),
      )
    }
  }, [currentLanguage.code, isCallActive, isMicMuted, sendToAssistant, t])

  // старт видеозвонка: камера + микрофон
  const startCall = useCallback(async () => {
    setIsConnecting(true)
    setNetworkError(null)
    setMessages([])

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false, // звук берём через SpeechRecognition
        })
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream
        }
        userStreamRef.current = stream
        setIsCameraOn(true)
      }
    } catch (e) {
      console.error("Camera error:", e)
      setIsCameraOn(false)
      // даже если камера не дала доступ — голос всё равно работает
    }

    setIsCallActive(true)
    setIsConnecting(false)
    startRecognition()
  }, [startRecognition])

  const endCall = useCallback(() => {
    stopEverything()
  }, [stopEverything])

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    if (next) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      setIsListening(false)
    } else if (isCallActive) {
      startRecognition()
    }
  }

  const toggleCamera = () => {
    const next = !isCameraOn
    setIsCameraOn(next)

    if (userStreamRef.current) {
      userStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = next
      })
    }
  }

  const userEmailDisplay = effectiveEmail

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
                  {t("AI Psychologist Video Call")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "Talk out loud, the assistant will listen, respond and voice the reply.",
                  )}
                </DialogDescription>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Video assistant online")}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-indigo-100">
                  {connectionStatus === "connected" ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-200" />{" "}
                      {t("Connected")}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-rose-200" />{" "}
                      {t("Disconnected")}
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[560px] flex-col md:h-[600px]">
            {/* ВИДЕО-БЛОК */}
            <div className="px-5 pt-4">
              <div className="relative mx-auto h-52 w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 sm:h-64">
                <img
                  src={AI_AVATAR_URL}
                  alt="AI Psychologist"
                  className="h-full w-full object-cover"
                />

                {/* PIP с камерой пользователя */}
                <video
                  ref={userVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-3 right-3 h-16 w-20 rounded-xl border border-white/40 bg-black/40 object-cover shadow-md"
                />

                {/* один статус, без дублирования */}
                {isCallActive && (
                  <div className="absolute right-3 top-3 rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-medium text-white shadow-sm">
                    {isAiSpeaking
                      ? t("Responding…")
                      : isListening
                        ? t("Listening…")
                        : t("Paused")}
                  </div>
                )}
              </div>
            </div>

            {/* СООБЩЕНИЯ */}
            <ScrollArea className="flex-1 px-5 pt-3 pb-2">
              <div className="space-y-3">
                {!isCallActive && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">
                      {t("How it works")}
                    </p>
                    <p>
                      {t(
                        "Press the button to start a video call, allow camera and microphone access, then speak as with a real psychologist.",
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t(
                        "Your e-mail will be used only to personalize the session.",
                      )}{" "}
                      ({userEmailDisplay})
                    </p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.from === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs md:text-sm ${
                        m.from === "user"
                          ? "bg-blue-50 text-slate-900"
                          : "bg-emerald-50 text-slate-900"
                      }`}
                    >
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-medium">
                        {m.from === "user" ? (
                          <span className="text-blue-700">
                            {t("You said")}
                          </span>
                        ) : (
                          <>
                            <Brain className="h-3 w-3 text-emerald-700" />
                            <span className="text-emerald-800">
                              {t("Dr. Alexander")}
                            </span>
                          </>
                        )}
                      </p>
                      <p>{m.text}</p>
                    </div>
                  </div>
                ))}

                {isAiThinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("Assistant is thinking…")}
                    </div>
                  </div>
                )}

                {networkError && (
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">
                    {networkError}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Sparkles className="h-3 w-3" />
                  {isListening
                    ? t("Listening… you can speak.")
                    : isCallActive
                      ? t("Paused. Turn on microphone to continue.")
                      : t(
                          "In crisis situations, please contact local emergency services immediately.",
                        )}
                </div>

                {isCallActive && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleCamera}
                      className={`h-8 w-8 rounded-full border ${
                        isCameraOn
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {isCameraOn ? (
                        <VideoIcon className="h-4 w-4" />
                      ) : (
                        <VideoOff className="h-4 w-4" />
                      )}
                    </Button>

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
                      {isMicMuted ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
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
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={startCall}
                    disabled={isConnecting}
                    className="h-9 rounded-full bg-indigo-600 px-5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t("Connecting")}
                      </>
                    ) : (
                      <>
                        <Phone className="mr-1 h-3 w-3" />
                        {t("Start video session")}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
