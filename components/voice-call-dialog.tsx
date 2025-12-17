"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Brain, Mic, MicOff, Loader2, Sparkles } from "lucide-react"
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

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

const FALLBACK_CHAT_API = "/api/chat"

// --- настройки сегментации речи (без WebAudio) ---
const REC_TIMESLICE_MS = 350
const END_SILENCE_MS = 1300
const MIN_VOICE_CHUNK_BYTES = 1200
const MIN_UTTERANCE_BYTES = 7000
const MAX_UTTERANCE_MS = 35_000
const MAX_RESTARTS = 3

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

function safeJsonParse(raw: string): any {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)

  // текущая "фраза"
  const chunksRef = useRef<Blob[]>([])
  const bytesRef = useRef(0)
  const utterStartRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const hasVoiceRef = useRef(false)
  const finalizingRef = useRef(false)
  const ttsHoldRef = useRef(false)

  const restartCountRef = useRef(0)

  const DEBUG =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1"

  const dlog = (...args: any[]) => {
    if (!DEBUG) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function computeShortLang(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"
    if (lang.startsWith("uk")) return "uk"
    if (lang.startsWith("ru")) return "ru"
    return "en"
  }

  function getTtsGender(): "MALE" | "FEMALE" {
    return (voiceGenderRef.current || "female") === "male" ? "MALE" : "FEMALE"
  }

  function pickMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ]
    for (const c of candidates) {
      try {
        if ((MediaRecorder as any).isTypeSupported?.(c)) return c
      } catch {
        // ignore
      }
    }
    return undefined
  }

  async function handleUserText(text: string) {
    const langCode = computeShortLang()

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    dlog("[CHAT] send ->", resolvedWebhook, { langCode, gender: voiceGenderRef.current })

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

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      const data = safeJsonParse(raw) ?? raw
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
    } catch (e: any) {
      console.error("[CHAT] error", e)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
  }

  async function sendToStt(blob: Blob) {
    // не шлём STT во время TTS/мута — это мусор
    if (ttsHoldRef.current || isMicMuted) return
    if (!blob || blob.size < MIN_UTTERANCE_BYTES) return

    try {
      dlog("[STT] send", { size: blob.size, type: blob.type || "audio/*" })

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "x-language": computeLangCode(),
        },
        body: blob,
      })

      const raw = await res.text()
      const data = safeJsonParse(raw)

      if (!res.ok || !data || data.success === false) {
        dlog("[STT] error", res.status, raw)
        return
      }

      const text = (data.text || "").toString().trim()
      dlog("[STT] text=", text)
      if (!text) return

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }
      setMessages((prev) => [...prev, userMsg])

      await handleUserText(text)
    } catch (e) {
      console.error("[STT] fatal", e)
    }
  }

  function stopRecorderOnly(reason: string) {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state === "inactive") return

    dlog("[REC] stop(", reason, ") state=", rec.state)
    try {
      rec.stop()
    } catch (e) {
      console.error("[REC] stop error", e)
    }
  }

  function resetUtterance() {
    chunksRef.current = []
    bytesRef.current = 0
    utterStartRef.current = Date.now()
    lastVoiceAtRef.current = 0
    hasVoiceRef.current = false
    finalizingRef.current = false
  }

  function shouldFinalizeBySilence(now: number) {
    if (!hasVoiceRef.current) return false
    if (!lastVoiceAtRef.current) return false
    return now - lastVoiceAtRef.current >= END_SILENCE_MS
  }

  function shouldFinalizeByMax(now: number) {
    if (!hasVoiceRef.current) return false
    if (!utterStartRef.current) return false
    return now - utterStartRef.current >= MAX_UTTERANCE_MS
  }

  function finalize(reason: "silence" | "max") {
    if (finalizingRef.current) return
    finalizingRef.current = true
    dlog("[UTT] finalize", reason, { bytes: bytesRef.current })
    stopRecorderOnly(`utt-${reason}`)
  }

  function startRecorder() {
    if (!mediaStreamRef.current) return
    if (!isCallActive) return
    if (isMicMuted) return
    if (ttsHoldRef.current) return

    const stream = mediaStreamRef.current

    // если вдруг старый рекордер жив — гасим
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      stopRecorderOnly("pre-start")
    }

    resetUtterance()

    const mimeType = pickMimeType()
    const opts: MediaRecorderOptions = mimeType ? { mimeType } : {}

    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, opts)
    } catch (e) {
      // последний шанс — без opts
      rec = new MediaRecorder(stream)
    }

    recorderRef.current = rec

    rec.onstart = () => {
      setIsListening(true)
      dlog("[REC] start(", REC_TIMESLICE_MS, ") mime=", rec.mimeType)
    }

    rec.ondataavailable = (ev: BlobEvent) => {
      const now = Date.now()
      const size = ev.data?.size || 0

      if (size > 0) {
        chunksRef.current.push(ev.data)
        bytesRef.current += size
      }

      // VAD по размеру чанка
      if (size >= MIN_VOICE_CHUNK_BYTES) {
        hasVoiceRef.current = true
        lastVoiceAtRef.current = now
      }

      if (DEBUG) {
        dlog("[REC] chunk", {
          size,
          total: bytesRef.current,
          hasVoice: hasVoiceRef.current,
          sinceVoice: lastVoiceAtRef.current ? now - lastVoiceAtRef.current : null,
          state: rec.state,
          track: stream.getAudioTracks()[0]?.readyState,
        })
      }

      if (!ttsHoldRef.current && !isMicMuted) {
        if (shouldFinalizeBySilence(now)) finalize("silence")
        else if (shouldFinalizeByMax(now)) finalize("max")
      }
    }

    rec.onerror = (ev: any) => {
      console.error("[REC] error", ev)
      dlog("[REC] error", ev?.name, ev?.message)
    }

    rec.onstop = async () => {
      setIsListening(false)

      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" })
      const size = blob.size

      dlog("[REC] stopped -> blob", { size, type: blob.type, ttsHold: ttsHoldRef.current })

      // если это стоп из-за TTS/мута/закрытия — просто сброс и не шлём STT
      if (ttsHoldRef.current || isMicMuted || !isCallActive) {
        resetUtterance()
        // если call active и не ttsHold и не muted — перезапустим ниже по условиям
      } else {
        // шлём только если реально был голос и нормальный объём
        if (hasVoiceRef.current && size >= MIN_UTTERANCE_BYTES) {
          await sendToStt(blob)
        }
        resetUtterance()
      }

      // автоперезапуск записи
      if (isCallActive && !ttsHoldRef.current && !isMicMuted) {
        // маленькая пауза, чтобы Safari/Chrome не глючили на моментальном start()
        setTimeout(() => {
          if (isCallActive && !ttsHoldRef.current && !isMicMuted) startRecorder()
        }, 120)
      }
    }

    // старт
    try {
      rec.start(REC_TIMESLICE_MS)
    } catch (e) {
      console.error("[REC] start failed", e)
      setNetworkError(t("Could not start microphone. Check permissions and try again."))
    }
  }

  async function ensureStream() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setNetworkError(
        t(
          "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."
        )
      )
      return null
    }

    // если уже есть — используем
    if (mediaStreamRef.current) return mediaStreamRef.current

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any,
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    mediaStreamRef.current = stream

    const track = stream.getAudioTracks()[0]
    if (track) {
      restartCountRef.current = 0

      track.onended = async () => {
        dlog("[MIC] track ended")

        if (!isCallActive) return

        restartCountRef.current += 1
        if (restartCountRef.current > MAX_RESTARTS) {
          setNetworkError(t("Microphone stopped unexpectedly. Please reload the page and try again."))
          return
        }

        // пробуем пересоздать поток
        try {
          dlog("[MIC] restarting stream attempt", restartCountRef.current)
          stopAll(true)
          mediaStreamRef.current = null
          await ensureStream()
          if (isCallActive && !ttsHoldRef.current && !isMicMuted) startRecorder()
        } catch (e) {
          console.error("[MIC] restart failed", e)
          setNetworkError(t("Microphone stopped unexpectedly. Please reload the page and try again."))
        }
      }
    }

    return stream
  }

  function stopAll(keepUiState = false) {
    // recorder
    const rec = recorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null

    // stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => {
        try {
          tr.onended = null
          tr.stop()
        } catch {
          // ignore
        }
      })
      mediaStreamRef.current = null
    }

    // audio
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // ignore
      }
      audioRef.current = null
    }

    chunksRef.current = []
    bytesRef.current = 0
    utterStartRef.current = 0
    lastVoiceAtRef.current = 0
    hasVoiceRef.current = false
    finalizingRef.current = false
    ttsHoldRef.current = false

    if (!keepUiState) {
      setIsListening(false)
      setIsMicMuted(false)
      setIsAiSpeaking(false)
    }
  }

  function endCall() {
    dlog("[CALL] end")
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)
    stopAll()
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    try {
      setIsCallActive(true)
      const stream = await ensureStream()
      if (!stream) {
        setIsCallActive(false)
        setIsConnecting(false)
        return
      }

      // стартуем рекордер
      ttsHoldRef.current = false
      setIsMicMuted(false)
      startRecorder()

      setIsConnecting(false)
    } catch (e: any) {
      console.error("[CALL] start error", e)
      setIsConnecting(false)
      setIsCallActive(false)

      const name = e?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."
          )
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(
          t("Could not start microphone. Check permissions in the browser and system settings, then try again.")
        )
      }

      if (onError && e instanceof Error) onError(e)
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return

    const clean = (text || "").trim()
    if (!clean) return

    const langCode = computeLangCode()
    const gender = getTtsGender()

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, language: langCode, gender }),
        })

        const raw = await res.text()
        const data = safeJsonParse(raw)

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          console.error("[TTS] bad response", data || raw)
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        // перед тем как проигрывать — стопаем запись (не пауза, чтобы не ломать десктоп)
        ttsHoldRef.current = true
        stopRecorderOnly("tts-start")
        setIsAiSpeaking(true)

        if (audioRef.current) {
          try {
            audioRef.current.pause()
          } catch {
            // ignore
          }
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsAiSpeaking(false)
          ttsHoldRef.current = false
          audioRef.current = null

          if (isCallActive && !isMicMuted) {
            startRecorder()
          }
        }

        audio.onerror = () => {
          setIsAiSpeaking(false)
          ttsHoldRef.current = false
          audioRef.current = null

          if (isCallActive && !isMicMuted) {
            startRecorder()
          }
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          setIsAiSpeaking(false)
          ttsHoldRef.current = false
          audioRef.current = null
          if (isCallActive && !isMicMuted) startRecorder()
        }
      } catch (e) {
        console.error("[TTS] fatal", e)
        setIsAiSpeaking(false)
        ttsHoldRef.current = false
      }
    })()
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    if (next) {
      // mute: стопаем рекордер, стрим не трогаем
      stopRecorderOnly("mute")
    } else {
      // unmute: стартуем заново
      if (isCallActive) {
        ttsHoldRef.current = false
        startRecorder()
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
      <DialogContent className="max-w-xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              {t("Voice session with AI-psychologist")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-indigo-100">
              {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
            </DialogDescription>
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
                        msg.role === "user"
                          ? "rounded-br-sm bg-slate-900 text-white"
                          : "rounded-bl-sm bg-emerald-50 text-slate-900"
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
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">
                    {networkError}
                  </div>
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
                        isMicMuted
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
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
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {t("Choose voice for this session")}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                    <Button
                      type="button"
                      onClick={() => void startCall("female")}
                      disabled={isConnecting}
                      className="h-11 flex-1 rounded-full bg-pink-50 px-5 text-xs font-semibold text-pink-700 shadow-sm hover:bg-pink-100 sm:max-w-xs"
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
                      className="h-11 flex-1 rounded-full bg-sky-50 px-5 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-100 sm:max-w-xs"
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
