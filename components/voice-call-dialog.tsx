"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Phone, X, Brain, Mic, MicOff, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

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

function getLocale(code: string): string {
  const map: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    uk: "uk-UA",
  }
  return map[code] || "en-US"
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
  const [isListening, setIsListening] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [connectionOk, setConnectionOk] = useState(true)

  const [transcript, setTranscript] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const recognitionRef = useRef<any>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const locale = getLocale(currentLanguage.code)
  const userEmailDisplay = userEmail || user?.email || "guest@example.com"

  // ========= SPEECH SYNTHESIS =========

  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return

      try {
        window.speechSynthesis.cancel()
        if (!text.trim()) return

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = locale

        const voices = window.speechSynthesis.getVoices()
        const matched =
          voices.find((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase())) ||
          voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
          voices[0]

        if (matched) {
          utterance.voice = matched
        }

        utterance.rate = 1
        utterance.pitch = 1
        utterance.onstart = () => setIsAiSpeaking(true)
        utterance.onend = () => {
          setIsAiSpeaking(false)
          currentUtteranceRef.current = null
        }
        utterance.onerror = () => {
          setIsAiSpeaking(false)
          currentUtteranceRef.current = null
        }

        currentUtteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      } catch (e) {
        console.error("Speech synthesis error:", e)
        setIsAiSpeaking(false)
      }
    },
    [locale],
  )

  // ========= OPENAI CALL =========

  const sendToAssistant = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      try {
        setErrorMsg("")
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            language: currentLanguage.code,
            email: userEmailDisplay,
            channel: "voice",
          }),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          console.error("Voice /api/chat error:", res.status, errText)
          throw new Error("Voice assistant error")
        }

        const data = await res.json()
        const reply: string =
          (data && (data.text as string)) ||
          t("I'm sorry, I couldn't process your message. Please try again.")

        setAiResponse(reply)
        speak(reply)
      } catch (err: any) {
        console.error("sendToAssistant error:", err)
        const msg = t("I'm sorry, I couldn't process your message. Please try again.")
        setAiResponse(msg)
        setErrorMsg(msg)
        if (onError) onError(err as Error)
      }
    },
    [currentLanguage.code, onError, speak, t, userEmailDisplay],
  )

  // ========= SPEECH RECOGNITION =========

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setErrorMsg(t("Your browser does not support voice input. Please try using Chrome."))
      setConnectionOk(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = locale
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setConnectionOk(true)
    }

    recognition.onresult = (event: any) => {
      let finalText = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        }
      }

      if (finalText.trim()) {
        const cleaned = finalText.trim()
        setTranscript((prev) => (prev ? `${prev} ${cleaned}` : cleaned))
        sendToAssistant(cleaned)
      }
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error)
      setIsListening(false)
      setConnectionOk(false)
      if (event.error === "not-allowed") {
        setErrorMsg(t("Microphone access denied. Please allow access in browser settings."))
      } else {
        setErrorMsg(t("Voice recognition error. Please try again."))
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      if (isCallActive && !isMicMuted) {
        // пробуем перезапустить, чтобы сессия была “длинной”
        try {
          recognition.start()
        } catch {
          // если не получилось – просто остановимся
        }
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (e) {
      console.error("Failed to start recognition:", e)
      setErrorMsg(t("Failed to start voice recognition."))
      setConnectionOk(false)
    }
  }, [isCallActive, isMicMuted, locale, sendToAssistant, t])

  // ========= КНОПКИ: старт / стоп / mute =========

  const startCall = async () => {
    setIsConnecting(true)
    setErrorMsg("")
    setAiResponse("")
    setTranscript("")

    setIsCallActive(true)
    setConnectionOk(true)

    // небольшая задержка, чтобы модалка успела отрисоваться
    setTimeout(() => {
      startRecognition()
      setIsConnecting(false)
    }, 200)
  }

  const endCall = () => {
    setIsCallActive(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    setIsConnecting(false)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch (e) {
        console.error("Stop recognition error:", e)
      }
      recognitionRef.current = null
    }

    if (currentUtteranceRef.current && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      currentUtteranceRef.current = null
    }

    setTimeout(onClose, 100)
  }

  const toggleMute = () => {
    const newMuted = !isMicMuted
    setIsMicMuted(newMuted)

    if (newMuted) {
      // mute
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error("Stop recognition (mute) error:", e)
        }
      }
      setIsListening(false)
    } else if (isCallActive) {
      // unmute
      startRecognition()
    }
  }

  // ======== cleanup on unmount / close ========

  useEffect(() => {
    if (!isOpen) {
      // если модалку закрыли – на всякий случай всё чистим
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null
          recognitionRef.current.stop()
        } catch {}
        recognitionRef.current = null
      }
      if (currentUtteranceRef.current && window.speechSynthesis) {
        window.speechSynthesis.cancel()
        currentUtteranceRef.current = null
      }
      setIsCallActive(false)
      setIsListening(false)
      setIsAiSpeaking(false)
      setIsConnecting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">{t("Voice Call with AI Psychologist")}</h3>
            <div className="text-xs text-lavender-200">
              {t("User")}: {userEmailDisplay}
            </div>
            <div className="text-xs text-lavender-200 mt-1">
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {connectionOk ? (
              <Wifi className="h-4 w-4 text-green-200" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-200" />
            )}
            <Button variant="ghost" size="icon" onClick={endCall} className="text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {!isCallActive ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center mb-6">
                <Phone className="h-12 w-12 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">
                {t("Ready to start your voice session?")}
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {t("Speak with AI psychologist for immediate, gentle support.")}
              </p>

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  {t("Voice communication language")}:
                </p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{currentLanguage.flag}</span>
                  {currentLanguage.name}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {t("AI will understand and respond in this language.")}
                </p>
              </div>

              <Button
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 flex items-center justify-center"
                onClick={startCall}
                disabled={isConnecting}
              >
                {isConnecting ? t("Connecting...") : t("Start Voice Session")}
              </Button>

              {errorMsg && (
                <p className="text-xs text-red-500 mt-4 text-center max-w-xs">
                  {errorMsg}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`h-16 w-16 rounded-full flex items-center justify-center ${
                      isAiSpeaking ? "bg-green-100 animate-pulse" : "bg-gray-100"
                    }`}
                  >
                    <Brain
                      className={`h-8 w-8 ${
                        isAiSpeaking ? "text-green-600" : "text-gray-600"
                      }`}
                    />
                  </div>
                </div>

                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    {isAiSpeaking
                      ? t("AI is speaking in {{language}}...", {
                          language: currentLanguage.name,
                        })
                      : isListening
                        ? t("Listening in {{language}}...", {
                            language: currentLanguage.name,
                          })
                        : isMicMuted
                          ? t("Microphone muted")
                          : t("Ready to listen in {{language}}", {
                              language: currentLanguage.name,
                            })}
                  </p>
                </div>

                {transcript && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-blue-700 mb-1">
                      {t("You said in {{language}}:", {
                        language: currentLanguage.name,
                      })}
                    </p>
                    <p className="text-sm text-blue-800">{transcript}</p>
                  </div>
                )}

                {aiResponse && (
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-green-700 mb-1">
                      {t("AI Psychologist in {{language}}:", {
                        language: currentLanguage.name,
                      })}
                    </p>
                    <p className="text-sm text-green-800">{aiResponse}</p>
                  </div>
                )}

                {errorMsg && (
                  <p className="text-xs text-red-500 mt-1 text-center">{errorMsg}</p>
                )}
              </div>

              <div className="flex justify-center space-x-4 pt-4 border-t">
                <Button
                  variant={isMicMuted ? "default" : "outline"}
                  size="icon"
                  onClick={toggleMute}
                  className={`h-12 w-12 rounded-full ${
                    isMicMuted ? "bg-red-500 hover:bg-red-600 text-white" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={endCall}
                  className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600"
                >
                  <Phone className="h-5 w-5 transform rotate-[135deg]" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
