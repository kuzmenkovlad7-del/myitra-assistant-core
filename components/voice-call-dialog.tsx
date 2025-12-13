"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Brain, Mic, MicOff, Loader2, Sparkles, X } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
  webhookUrl?: string
}

type VoiceMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  gender?: "female" | "male"
}

const TURBOTA_AGENT_WEBHOOK_URL = process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""
const FALLBACK_CHAT_API = "/api/chat"

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.text ||
      first.response ||
      first.output ||
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
      data.text ||
      data.response ||
      data.output ||
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

function pickBestRecorderMimeType(): string | undefined {
  const MR: any = typeof window !== "undefined" ? (window as any).MediaRecorder : null
  if (!MR?.isTypeSupported) return undefined

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4", // Safari/iOS часто именно так
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
  if (m.includes("webm")) return "speech.webm"
  if (m.includes("mp4")) return "speech.mp4"
  if (m.includes("mpeg") || m.includes("mp3")) return "speech.mp3"
  if (m.includes("wav")) return "speech.wav"
  if (m.includes("ogg")) return "speech.ogg"
  return "speech.bin"
}

export default function VoiceCallDialog({ isOpen, onClose, onError, userEmail, webhookUrl }: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  // debug overlay (включить: ?debug=1)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugLines, setDebugLines] = useState<string[]>([])
  const debugEnabledRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const enabled = new URLSearchParams(window.location.search).get("debug") === "1"
    setDebugEnabled(enabled)
    debugEnabledRef.current = enabled
  }, [])

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // очередь чанков (ВАЖНО: теперь отправляем в STT только новые чанки, без diff)
  const sttQueueRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const lastTranscriptRef = useRef<string>("")
  const suppressUntilRef = useRef<number>(0)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function dlog(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(...args)
    if (!debugEnabledRef.current) return
    const line =
      `[${new Date().toLocaleTimeString()}] ` +
      args
        .map((a) => {
          if (typeof a === "string") return a
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(" ")
    setDebugLines((prev) => [...prev, line].slice(-120))
  }

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function computeLangShort(): "uk" | "ru" | "en" {
    const lc = computeLangCode().toLowerCase()
    if (lc.startsWith("uk")) return "uk"
    if (lc.startsWith("ru")) return "ru"
    return "en"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  async function sendBlobToStt(blob: Blob): Promise<string> {
    const fd = new FormData()
    fd.append("file", blob, filenameForMime(blob.type || "audio/webm"))
    fd.append("language", computeLangShort())
    fd.append("locale", computeLangCode())

    const res = await fetch("/api/stt", { method: "POST", body: fd })
    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data || data.success === false) {
      dlog("[STT] error", res.status, raw)
      return ""
    }

    return String(data.text || "").trim()
  }

  async function maybeSendStt() {
    if (!isCallActiveRef.current) return
    if (isMicMuted) return
    if (isAiSpeakingRef.current) return
    if (Date.now() < suppressUntilRef.current) return

    if (isSttBusyRef.current) {
      dlog("[STT] skip: busy")
      return
    }
    if (!sttQueueRef.current.length) return

    // берём ровно ОДИН валидный chunk (MediaRecorder отдаёт самостоятельный webm/mp4 файл).
    // Нельзя склеивать несколько чанков в один Blob — получится битый контейнер и Whisper вернёт "Invalid file format".
    const blob = sttQueueRef.current.shift()
    if (!blob) return
    if (blob.size < 12000) {
      dlog("[STT] skip: too small", blob.size)
      return
    }

    try {
      isSttBusyRef.current = true
      dlog("[STT] sending chunk", { size: blob.size, type: blob.type })

      const text = await sendBlobToStt(blob)
      dlog("[STT] result", text)

      if (!text) return

      // защита от “дубликатов” одинакового результата
      if (text === lastTranscriptRef.current) return
      lastTranscriptRef.current = text

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }

      setMessages((prev) => [...prev, userMsg])
      await handleUserText(text)
    } catch (e: any) {
      dlog("[STT] fatal", e?.message || String(e))
    } finally {
      isSttBusyRef.current = false
    }
  }

  function stopAudioPlayback() {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch {}
      audioRef.current = null
    }
    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {}
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    const beginSpeaking = () => {
      isAiSpeakingRef.current = true
      setIsAiSpeaking(true)

      // ещё чуть-чуть “подавляем” STT после старта голоса (хвосты/эхо)
      suppressUntilRef.current = Date.now() + 800

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          sttQueueRef.current = []
            rec.stop()
            dlog("[Recorder] stop() during TTS")
        } catch {}
      }
    }

    const finishSpeaking = () => {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "inactive" && isCallActiveRef.current && !isMicMuted) {
        try {
          sttQueueRef.current = []
            setTimeout(() => {
              try {
                rec.start(3500)
                dlog("[Recorder] start() after TTS")
              } catch (e) {
                dlog("[Recorder] start() failed", (e instanceof Error) ? e.message : String(e))
              }
            }, 250)
        } catch {}
      }
    }

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, language: langCode, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          dlog("[TTS] error", res.status, raw)
          finishSpeaking()
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        stopAudioPlayback()

        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.onplay = beginSpeaking
        audio.onended = () => {
          finishSpeaking()
          audioRef.current = null
        }
        audio.onerror = () => {
          finishSpeaking()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch (e) {
          dlog("[TTS] play() rejected", e)
          finishSpeaking()
        }
      } catch (e) {
        dlog("[TTS] fetch error", e)
        finishSpeaking()
      }
    })()
  }

  async function handleUserText(text: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    dlog("[CHAT] send", { to: resolvedWebhook, lang: langCode, gender: voiceGenderRef.current })

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langCode,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: computeLangCode(),
        }),
      })

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      if (!res.ok) throw new Error(`Chat API error: ${res.status} ${raw}`)

      let answer = extractAnswer(data)
      if (!answer) {
        answer = t("I'm sorry, I couldn't process your message. Please try again.")
      }

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      dlog("[CHAT] error", error?.message || String(error))
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setNetworkError(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."),
        )
        setIsConnecting(false)
        return
      }
      if (!window.isSecureContext) {
        setNetworkError(t("Microphone requires HTTPS. Open the site via https://"))
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream

      const mimeType = pickBestRecorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder
      sttQueueRef.current = []
      isSttBusyRef.current = false
      lastTranscriptRef.current = ""
      suppressUntilRef.current = 0

      recorder.onstart = () => {
        dlog("[Recorder] onstart", { mimeType: recorder.mimeType })
        setIsListening(true)
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        // не пишем/не отправляем во время TTS или если mic muted
        if (!isCallActiveRef.current) return
        if (isAiSpeakingRef.current) return
        if (isMicMuted) return
        if (Date.now() < suppressUntilRef.current) return
        if (isSttBusyRef.current) { dlog("[STT] drop: busy"); return }

        if (event.data && event.data.size > 0) {
          sttQueueRef.current.push(event.data)
          dlog("[Recorder] chunk", { size: event.data.size, total: sttQueueRef.current.length })
          void maybeSendStt()
        }
      }

      recorder.onstop = () => {
        dlog("[Recorder] onstop")
        setIsListening(false)
      }

      recorder.onerror = (event: any) => {
        dlog("[Recorder] error", event?.name || "", event?.message || "")
      }

      // чанки каждые 3.5с — нормально для Whisper и меньше “шума” чем 1с
      recorder.start(3500)

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
      setIsMicMuted(false)
    } catch (error: any) {
      dlog("[Recorder] getUserMedia error", error?.name || "", error?.message || "")

      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."))
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(t("Could not start microphone. Check permissions in the browser and system settings, then try again."))
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
    }
  }

  const endCall = () => {
    dlog("[CALL] endCall")

    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)
    sttQueueRef.current = []
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false
    suppressUntilRef.current = 0
    isAiSpeakingRef.current = false

    stopAudioPlayback()

    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      mediaStreamRef.current = null
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    // чистим очередь чтобы не отстрелило “хвостом”
    sttQueueRef.current = []

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
          dlog("[CALL] mic muted -> pause()")
        } catch {}
      }
    } else {
      if (rec.state === "inactive" && isCallActiveRef.current && !isAiSpeakingRef.current) {
        try {
          rec.resume()
          dlog("[CALL] mic unmuted -> resume()")
        } catch {}
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endCall()
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isCallActive
    ? t("In crisis situations, please contact local emergency services immediately.")
    : isAiSpeaking
      ? t("Assistant is speaking...")
      : isMicMuted
        ? t("Paused. Turn on microphone to continue.")
        : isListening
          ? t("Listening… you can speak.")
          : t("Waiting... you can start speaking at any moment.")

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
      <DialogContent className="max-w-xl border-none bg-transparent p-0 [&>button]:hidden">
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t("Voice session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
                </DialogDescription>
              </div>

              {/* ОДИН крестик справа (как ты просил) */}
              <button
                type="button"
                aria-label={t("Close")}
                onClick={() => {
                  endCall()
                  onClose()
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
                {!isCallActive && messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
                    <p className="mb-2">
                      {t("Choose a voice and start the session. The assistant will listen to you and answer like a real psychologist.")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t("You can switch between female and male voice by ending the call and starting again with a different option.")}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        msg.role === "user" ? "rounded-br-sm bg-slate-900 text-white" : "rounded-bl-sm bg-emerald-50 text-slate-900"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                          <Brain className="h-3 w-3" />
                          {t("AI Psychologist")}
                          {msg.gender && (
                            <span className="ml-1 rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                              {msg.gender === "female" ? t("Female voice") : t("Male voice")}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs md:text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {networkError && (
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">{networkError}</div>
                )}
              </div>
            </ScrollArea>

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
                        isMicMuted ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
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
                <div className="flex flex-col items-center gap-3 pt-1">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("Choose voice for this session")}</div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                    <Button
                      type="button"
                      onClick={() => void startCall("female")}
                      disabled={isConnecting}
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
                        voiceGenderRef.current === "female" ? "bg-pink-600 text-white hover:bg-pink-700" : "bg-pink-50 text-pink-700 hover:bg-pink-100"
                      }`}
                    >
                      {isConnecting && voiceGenderRef.current === "female" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          {t("Start with female voice")}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void startCall("male")}
                      disabled={isConnecting}
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
                        voiceGenderRef.current === "male" ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
                    >
                      {isConnecting && voiceGenderRef.current === "male" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Brain className="h-3 w-3" />
                          {t("Start with male voice")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DEBUG PANEL */}
          {debugEnabled && (
            <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-black/70 p-2 text-[10px] text-white">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-semibold">debug</div>
                <button className="opacity-80 hover:opacity-100" onClick={() => setDebugLines([])}>
                  clear
                </button>
              </div>
              <div className="max-h-[120px] overflow-auto whitespace-pre-wrap leading-snug">
                {debugLines.length ? debugLines.join("\n") : "no logs yet"}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
