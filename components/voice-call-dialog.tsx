"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  X,
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
import { APP_NAME } from "@/lib/app-config"

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
}: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected")

  const recognitionRef = useRef<any | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // Полный сброс состояния и стека браузера
  const stopEverything = useCallback(() => {
    setIsCallActive(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    setTranscript("")
    setAiResponse("")
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setIsMicMuted(false)

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

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen, stopEverything])

  // Запуск SpeechRecognition
  const startRecognition = useCallback(() => {
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
      // мягкий автоперезапуск, пока звонок активен и микрофон не выключен
      if (isCallActive && !isMicMuted) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            console.error(e)
          }
        }, 400)
      }
    }

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text = last[0]?.transcript?.trim()
      if (!text) return

      setTranscript((prev) => (prev ? `${prev} ${text}` : text))
      void handleUserText(text)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (e) {
      console.error("Cannot start recognition", e)
      setNetworkError(
        t("Could not start microphone. Check permissions and try again."),
      )
    }
  }, [currentLanguage.code, isCallActive, isMicMuted, t])

  // Озвучка ответа через browser TTS
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return
      const utterance = new SpeechSynthesisUtterance(text)

      utterance.lang = currentLanguage.code.startsWith("uk")
        ? "uk-UA"
        : currentLanguage.code.startsWith("ru")
          ? "ru-RU"
          : "en-US"

      utterance.rate = 1
      utterance.pitch = 1

      utterance.onstart = () => setIsAiSpeaking(true)
      utterance.onend = () => setIsAiSpeaking(false)
      utterance.onerror = () => setIsAiSpeaking(false)

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    [currentLanguage.code],
  )

  // Отправка текста в наш API
  const handleUserText = useCallback(
    async (text: string) => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            language: currentLanguage.code,
            email: effectiveEmail,
            mode: "voice",
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const answer: string =
          (data && (data.text as string)) ||
          t("I'm sorry, I couldn't process your message. Please try again.")

        setAiResponse(answer)
        speakText(answer)
      } catch (error: any) {
        console.error("Voice call error:", error)
        setNetworkError(t("Connection error. Please try again."))
        if (onError && error instanceof Error) onError(error)
      }
    },
    [currentLanguage.code, effectiveEmail, onError, speakText, t],
  )

  const startCall = useCallback(() => {
    setIsConnecting(true)
    setNetworkError(null)

    setTimeout(() => {
      setIsCallActive(true)
      setIsConnecting(false)
      startRecognition()
    }, 200)
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
        } catch (e) {
          console.error(e)
        }
      }
      setIsListening(false)
    } else if (isCallActive) {
      startRecognition()
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
                  {t("Voice session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "You can talk out loud, the assistant will listen, answer and voice the reply.",
                  )}
                </DialogDescription>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Assistant online")}
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

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div className="space-y-3">
                {!isCallActive && (
                  <div className="rounded
