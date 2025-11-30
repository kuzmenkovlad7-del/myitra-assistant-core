"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
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
  User,
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

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

// язык для распознавания/озвучки
function getSpeechLang(code?: string): string {
  if (!code) return "en-US"
  if (code.startsWith("uk")) return "uk-UA"
  if (code.startsWith("ru")) return "ru-RU"
  if (code.startsWith("en")) return "en-US"
  return "en-US"
}

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
  const [isMicMuted, setIsMicMuted] = useState(false) // пользователь сознательно вырубил мик
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected")
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const recognitionRef = useRef<any | null>(null)
  const autoRestartRecognitionRef = useRef<boolean>(true)
  const isAiSpeakingRef = useRef<boolean>(false)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"
  const speechLang = getSpeechLang(currentLanguage?.code)

  // полный сброс всего состояния и Web APIs
  const stopEverything = useCallback(() => {
    setIsCallActive(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    setIsMicMuted(false)
    setMessages([])
    setConnectionStatus("disconnected")
    setNetworkError(null)

    autoRestartRecognitionRef.current = false

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
      recognitionRef.current = null
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // при закрытии модалки всё гасим
  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen, stopEverything])

  // логическое состояние микрофона
  const micOn = isCallActive && isListening && !isMicMuted

  // запуск распознавания речи
  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setNetworkError(
        t("Your browser does not support voice recognition. Please use Chrome or another modern browser."),
      )
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = speechLang

    recognition.onstart = () => {
      setIsListening(true)
      setConnectionStatus("connected")
      setNetworkError(null)
    }

    recognition.onerror = (event: any) => {
      console.error("[VIDEO] Speech recognition error", event)

      // долгое молчание → no-speech → уходим в «паузу» и глушим мик
      if (event?.error === "no-speech") {
        autoRestartRecognitionRef.current = false
        setIsListening(false)
        setIsMicMuted(true) // и логически, и визуально микрофон выключен
        setNetworkError(null)
        return
      }

      if (event?.error !== "no-speech") {
        setNetworkError(t("Error while listening. Please try again."))
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)

      // если мы сами отключили рестарт — ничего не перезапускаем
      if (!autoRestartRecognitionRef.current) {
        autoRestartRecognitionRef.current = true
        return
      }

      // авто-перезапуск, пока звонок активен и мик не выключен
      if (isCallActive && !isMicMuted && !isAiSpeakingRef.current) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
              console.error("[VIDEO] restart error", e)
          }
        }, 400)
      }
    }

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text = last[0]?.transcript?.trim()
      if (!text) return

      void handleUserText(text)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (e) {
      console.error("[VIDEO] Cannot start recognition", e)
      setNetworkError(t("Could not start microphone. Check permissions and try again."))
      setIsListening(false)
      setIsMicMuted(true)
    }
  }, [isCallActive, isMicMuted, speechLang, t])

  // озвучка ответа (один браузерный голос)
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return

      // перед озвучкой стопаем распознавание, чтобы не слушал сам себя
      if (recognitionRef.current) {
        try {
          autoRestartRecognitionRef.current = false
          recognitionRef.current.stop()
        } catch (e) {
          console.error("[VIDEO] stop recognition before TTS", e)
        }
      }
      setIsListening(false)

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = speechLang
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1

      utterance.onstart = () => {
        isAiSpeakingRef.current = true
        setIsAiSpeaking(true)
      }

      utterance.onend = () => {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)

        if (isCallActive && !isMicMuted) {
          autoRestartRecognitionRef.current = true
          startRecognition()
        }
      }

      utterance.onerror = () => {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        if (isCallActive && !isMicMuted) {
          autoRestartRecognitionRef.current = true
          startRecognition()
        }
      }

      window.speechSynthesis.speak(utterance)
    },
    [isCallActive, isMicMuted, speechLang, startRecognition],
  )

  // отправка реплики в /api/chat и добавление в чат
  const handleUserText = useCallback(
    async (text: string) => {
      setMessages((prev) => [...prev, { id: prev.length + 1, role: "user", text }])

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            language: currentLanguage?.code,
            email: effectiveEmail,
            mode: "video",
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const answer: string =
          (data && (data.text as string)) ||
          t("I'm sorry, I couldn't process your message. Please try again.")

        setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: answer }])

        speakText(answer)
      } catch (error: any) {
        console.error("Video call error:", error)
        setNetworkError(t("Connection error. Please try again."))

        const fallback = t("I'm sorry, I couldn't process your message. Please try again.")

        setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: fallback }])

        if (onError && error instanceof Error) onError(error)
      }
    },
    [currentLanguage?.code, effectiveEmail, onError, speakText, t],
  )

  // старт «видеосессии» (по сути — тот же voice, только с аватаром)
  const startCall = useCallback(() => {
    setIsConnecting(true)
    setNetworkError(null)
    setMessages([])

    setTimeout(() => {
      setIsCallActive(true)
      setIsConnecting(false)
      setIsMicMuted(false)
      startRecognition()
    }, 200)
  }, [startRecognition])

  const endCall = useCallback(() => {
    stopEverything()
  }, [stopEverything])

  // переключение микрофона
  const toggleMic = () => {
    if (micOn) {
      // выключаем мик
      setIsMicMuted(true)
      autoRestartRecognitionRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      setIsListening(false)
    } else {
      // включаем мик
      setIsMicMuted(false)
      setNetworkError(null)
      autoRestartRecognitionRef.current = true
      if (isCallActive) {
        startRecognition()
      }
    }
  }

  const statusText = (() => {
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (micOn) return t("Listening… you can speak.")
    if (isCallActive) return t("Paused. Turn on microphone to continue.")
    return t("In crisis situations, please contact local emergency services immediately.")
  })()

  // какую картинку берём как «девушка-психолог»
  const avatarSrc = "/dr-sophia-new.jpg" // одна из трёх из public, можно потом сделать выбор

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
      <DialogContent className="max-w-3xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {t("Video session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("You see the avatar of a psychologist, speak out loud, and the assistant will answer in your language.")}
                </DialogDescription>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Assistant online")}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-indigo-100">
                  {connectionStatus === "connected" ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-200" /> {t("Connected")}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-rose-200" /> {t("Disconnected")}
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[520px] flex-col md:h-[560px]">
            {/* Блок «видео» — аватар психолога */}
            <div className="flex items-center justify-center border-b border-slate-100 bg-slate-950 px-5 py-4">
              <div className="flex w-full max-w-md items-center gap-4">
                <div className="relative">
                  <div
                    className={`relative h-24 w-24 overflow-hidden rounded-3xl border bg-slate-900 md:h-28 md:w-28 ${
                      isAiSpeaking
                        ? "border-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.35)] animate-[pulse_1.6s_ease-in-out_infinite]"
                        : "border-slate-600 shadow-inner"
                    }`}
                  >
                    <Image
                      src={avatarSrc}
                      alt={t("AI psychologist avatar")}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-900/10" />
                  </div>
                  <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-900/90 px-2.5 py-0.5 text-[10px] text-slate-100 shadow-md">
                    {isAiSpeaking ? (
                      <>
                        <Brain className="h-3 w-3 text-emerald-300" />
                        {t("Speaking")}
                      </>
                    ) : micOn ? (
                      <>
                        <Mic className="h-3 w-3 text-emerald-300" />
                        {t("Listening")}
                      </>
                    ) : (
                      <>
                        <Phone className="h-3 w-3 text-sky-300" />
                        {isCallActive ? t("Paused") : t("Waiting")}
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-100">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Brain className="h-4 w-4 text-emerald-300" />
                    {t("AI Psychologist")}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    {t("Talk as in a video session, the avatar reacts when the assistant answers you.")}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t("Language")}: {currentLanguage?.name}{" "}
                    {currentLanguage && "flag" in currentLanguage ? (currentLanguage as any).flag : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Чат с репликами */}
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div className="space-y-3">
                {!isCallActive && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
                    <p>
                      {t(
                        "Press the button to start the session, allow microphone access and speak as with a real psychologist.",
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t("Your data is processed securely and not shared with third parties.")}
                    </p>
                  </div>
                )}

                {messages.map((msg) =>
                  msg.role === "user" ? (
                    <div
                      key={msg.id}
                      className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-3 text-xs text-slate-900 md:text-sm"
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
                      className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs text-slate-900 md:text-sm"
                    >
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                        <Brain className="h-3.5 w-3.5" />
                        {t("AI Psychologist")}
                      </p>
                      <p>{msg.text}</p>
                    </div>
                  ),
                )}

                {networkError && (
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">{networkError}</div>
                )}
              </div>
            </ScrollArea>

            {/* Статус + кнопки управления */}
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
                        micOn
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
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
