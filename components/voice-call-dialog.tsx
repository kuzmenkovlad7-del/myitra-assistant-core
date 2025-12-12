"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Phone, Mic, MicOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type VoiceGender = "female" | "male"
type Author = "user" | "assistant"

interface CallMessage {
  id: string
  author: Author
  text: string
  voice?: VoiceGender // для ассистента запоминаем, каким голосом сказано
}

type ConnectionStatus = "idle" | "connected" | "error"

const DEBUG = true

function logDebug(msg: string, ...args: any[]) {
  if (typeof window === "undefined" || !DEBUG) return
  const ts = new Date().toISOString()
  // eslint-disable-next-line no-console
  console.log(`${ts} ${msg}`, ...args)
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // eslint-disable-next-line no-undef
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function detectLangCode(): string {
  if (typeof navigator === "undefined") return "ru-RU"
  const lng = navigator.language.toLowerCase()

  if (lng.startsWith("uk")) return "uk-UA"
  if (lng.startsWith("en")) return "en-US"
  if (lng.startsWith("pl")) return "pl-PL"
  if (lng.startsWith("de")) return "de-DE"

  return "ru-RU"
}

interface VoiceCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VoiceCallDialog({ open, onOpenChange }: VoiceCallDialogProps) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<CallMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle")

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recorderMimeRef = useRef<string | null>(null)

  const pendingChunksRef = useRef<BlobPart[]>([])
  const pendingSizeRef = useRef<number>(0)
  const isSttBusyRef = useRef(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const voiceGenderRef = useRef<VoiceGender>("female")

  const langCodeRef = useRef<string>(detectLangCode())

  const scrollRef = useRef<HTMLDivElement | null>(null)

  // автоскролл вниз
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  function getCurrentGender(): VoiceGender {
    return voiceGenderRef.current ?? "female"
  }

  function resetRecorderBuffer() {
    pendingChunksRef.current = []
    pendingSizeRef.current = 0
  }

  function fullCleanup() {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false
    setIsMicMuted(false)
    isMicMutedRef.current = false
    setConnectionStatus("idle")
    resetRecorderBuffer()

    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null

    const stream = mediaStreamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {
          // ignore
        }
      })
    }
    mediaStreamRef.current = null

    const audio = audioRef.current
    if (audio) {
      try {
        audio.pause()
        audio.src = ""
      } catch {
        // ignore
      }
    }
  }

  // полная зачистка при размонтировании
  useEffect(() => {
    return () => {
      fullCleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // TTS
  async function speakText(text: string) {
    const clean = text.trim()
    if (!clean || !isCallActiveRef.current) return

    const lang = langCodeRef.current
    const gender = getCurrentGender()

    logDebug("[TTS] speakText", {
      lang,
      gender,
      sample: clean.slice(0, 80),
    })

    setIsAiSpeaking(true)
    isAiSpeakingRef.current = true

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          lang,
          gender,
        }),
      })

      const ok = res.ok
      const buf = await res.arrayBuffer()

      if (!ok) {
        throw new Error(
          `TTS error: ${res.status} ${res.statusText}`,
        )
      }

      const blob = new Blob([buf], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)

      let audio = audioRef.current
      if (!audio) {
        audio = new Audio()
        audioRef.current = audio
      }

      audio.onended = () => {
        URL.revokeObjectURL(url)
        logDebug("[TTS] audio ended")
      }
      audio.onerror = (e) => {
        logDebug("[TTS] audio error", e)
      }

      audio.src = url
      await audio.play()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[TTS] error", e)
      setNetworkError(
        "Проблема с озвучкой ответа. Попробуйте сказать фразу ещё раз.",
      )
    } finally {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
    }
  }

  async function sendToAssistant(userText: string) {
    const clean = userText.trim()
    if (!clean) return

    const lang = langCodeRef.current
    const gender = getCurrentGender()

    const userMsg: CallMessage = {
      id: createId(),
      author: "user",
      text: clean,
    }

    setMessages((prev) => [...prev, userMsg])

    try {
      logDebug("[CHAT] send to n8n", { lang, gender })

      const res = await fetch(
        "https://n8n.vladkuzmenko.com/webhook/turbotaai-agent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: clean,
            lang,
            gender,
          }),
        },
      )

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        throw new Error(
          `Agent error: ${res.status} ${res.statusText} body=${raw.slice(
            0,
            200,
          )}`,
        )
      }

      const assistantText: string =
        (data?.reply ??
          data?.text ??
          data?.message ??
          data?.answer ??
          "Спасибо, я вас слышу. Продолжайте, пожалуйста.")
          .toString()
          .trim()

      const assistantMsg: CallMessage = {
        id: createId(),
        author: "assistant",
        text: assistantText,
        voice: gender,
      }

      setMessages((prev) => [...prev, assistantMsg])

      await speakText(assistantText)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[CHAT] error", e)
      setNetworkError(
        "Не удалось связаться с ассистентом. Проверьте интернет и попробуйте ещё раз.",
      )
    }
  }

  // STT — берём только свежий буфер и НЕ копим всю историю,
  // чтобы backend не получал огромный файл и не слетал в 500.
  async function runSttOnce() {
    if (!isCallActiveRef.current) {
      resetRecorderBuffer()
      return
    }

    if (isAiSpeakingRef.current || isMicMutedRef.current) {
      resetRecorderBuffer()
      return
    }

    if (isSttBusyRef.current) return

    const chunks = pendingChunksRef.current
    const size = pendingSizeRef.current

    if (!chunks.length || size < 20000) {
      // слишком короткий/пустой звук — не мучаем STT
      return
    }

    const mime =
      recorderMimeRef.current ||
      "audio/webm;codecs=opus"

    const blob = new Blob(chunks, { type: mime })
    resetRecorderBuffer()

    logDebug(`[STT] sending audio blob size=${blob.size}`)

    isSttBusyRef.current = true

    try {
      const res = await fetch("https://www.turbotaai.com/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": "audio/webm",
        },
        body: blob,
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.success === false) {
        const errMsg =
          data?.error || `${res.status} ${res.statusText}` || "Unknown STT error"

        logDebug(
          `[STT] error status=${res.status} msg=${errMsg}`,
        )
        // eslint-disable-next-line no-console
        console.error("[STT] error response:", res.status, raw)

        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            author: "assistant",
            text: "Не удалось распознать речь. Пожалуйста, повторите фразу.",
            voice: getCurrentGender(),
          },
        ])

        return
      }

      const text: string = (data.text || "").toString().trim()
      logDebug(`[STT] transcript="${text}"`)

      if (!text) return

      await sendToAssistant(text)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[STT] fatal error", e)
      setNetworkError(
        "Проблема с распознаванием речи. Попробуйте ещё раз или выберите другой формат общения.",
      )
    } finally {
      isSttBusyRef.current = false
    }
  }

  async function startCall(gender: VoiceGender) {
    logDebug(`gender=${gender}`)
    logDebug("[CALL] startCall")

    voiceGenderRef.current = gender
    langCodeRef.current = detectLangCode()

    setIsConnecting(true)
    setNetworkError(null)
    resetRecorderBuffer()

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      mediaStreamRef.current = stream

      const options: MediaRecorderOptions = {}
      try {
        if (
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ) {
          options.mimeType = "audio/webm;codecs=opus"
        } else if (
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported("audio/webm")
        ) {
          options.mimeType = "audio/webm"
        }
      } catch {
        // ignore
      }

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      recorderMimeRef.current = recorder.mimeType || options.mimeType || null

      recorder.onstart = () => {
        logDebug("[Recorder] onstart")
        setIsListening(true)
      }

      recorder.onstop = () => {
        logDebug("[Recorder] onstop")
        setIsListening(false)
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return
        if (!isCallActiveRef.current) return

        if (isAiSpeakingRef.current || isMicMutedRef.current) {
          logDebug("[Recorder] skip chunk: AI speaking or mic muted")
          return
        }

        pendingChunksRef.current.push(event.data)
        pendingSizeRef.current += event.data.size

        logDebug(
          `[Recorder] dataavailable size=${event.data.size} queueSize=${pendingSizeRef.current}`,
        )

        void runSttOnce()
      }

      recorder.onerror = (event) => {
        // eslint-disable-next-line no-console
        console.error("[Recorder] error", event)
        setNetworkError(
          "Ошибка записи микрофона. Попробуйте перезапустить голосовую сессию.",
        )
      }

      recorder.start(4000)
      logDebug("[Recorder] start(4000) — chunk каждые 4с")

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
      setConnectionStatus("connected")

      // приветственное сообщение добавляем в историю, не стирая старую
      const welcome: CallMessage = {
        id: createId(),
        author: "assistant",
        text:
          "Здравствуйте! Как вы сегодня? Есть ли что-то, о чём вы хотели бы поговорить или обсудить?",
        voice: gender,
      }
      setMessages((prev) => [...prev, welcome])

      await speakText(welcome.text)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[CALL] startCall error", e)
      setIsConnecting(false)
      setConnectionStatus("error")
      setNetworkError(
        "Не удалось получить доступ к микрофону. Проверьте разрешения в браузере.",
      )
    }
  }

  function endCall() {
    logDebug("[CALL] endCall")
    fullCleanup()
  }

  function toggleMic() {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next
  }

  const statusLabel =
    connectionStatus === "connected"
      ? isAiSpeaking
        ? "Ассистент говорит..."
        : isListening
        ? "Ассистент слушает, можно говорить."
        : "Подключено"
      : connectionStatus === "error"
      ? "Ошибка подключения"
      : "Отключено"

  const statusDotClass =
    connectionStatus === "connected"
      ? "bg-emerald-400"
      : connectionStatus === "error"
      ? "bg-red-400"
      : "bg-slate-400"

  function handleDialogOpenChange(next: boolean) {
    if (!next) {
      endCall()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-slate-950 text-slate-50 border border-slate-800">
        <div className="flex flex-col h-[560px]">
          {/* HEADER */}
          <div className="relative px-6 pt-5 pb-4 bg-gradient-to-r from-[#5f6bff] via-[#9b5cff] to-[#ff6f9b] text-white">
            <button
              type="button"
              onClick={() => handleDialogOpenChange(false)}
              className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-xs mb-1 opacity-90">Голосовой формат</div>
            <h2 className="text-lg font-semibold">
              Голосовая сессия с AI-психологом
            </h2>
            <p className="mt-1 text-xs max-w-[320px] text-white/80">
              Вы можете говорить вслух — ассистент будет слушать, отвечать и
              озвучивать ответы.
            </p>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-white/80">
              <span
                className={cn(
                  "inline-flex h-2 w-2 rounded-full",
                  statusDotClass,
                )}
              />
              <span>{statusLabel}</span>
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 flex flex-col bg-slate-950">
            <div
              ref={scrollRef}
              className="flex-1 px-4 py-3 space-y-3 overflow-y-auto scroll-smooth"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1",
                    msg.author === "assistant"
                      ? "items-start"
                      : "items-end",
                  )}
                >
                  {msg.author === "assistant" && (
                    <div className="flex flex-wrap gap-1 text-[10px] font-medium text-emerald-800">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/90 px-2 py-0.5">
                        AI-психолог
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/90 px-2 py-0.5">
                        {msg.voice === "male"
                          ? "мужской голос"
                          : "женский голос"}
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm",
                      msg.author === "assistant"
                        ? "self-start bg-emerald-50 text-emerald-950"
                        : "self-end bg-slate-900 text-slate-50",
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {!messages.length && (
                <div className="mt-4 text-xs text-slate-400">
                  Когда начнёте голосовую сессию, здесь появится история
                  диалога.
                </div>
              )}
            </div>

            {/* FOOTER */}
            {isCallActive ? (
              <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{statusLabel}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border text-slate-50 transition",
                      isMicMuted
                        ? "bg-slate-800 border-slate-600"
                        : "bg-emerald-500 border-emerald-400",
                    )}
                    aria-label={
                      isMicMuted ? "Включить микрофон" : "Выключить микрофон"
                    }
                  >
                    {isMicMuted ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={endCall}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition"
                    aria-label="Завершить звонок"
                  >
                    <Phone className="h-4 w-4 rotate-[135deg]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-800 px-4 py-3 flex flex-col gap-3">
                <div className="text-[11px] text-slate-400">
                  В кризисных ситуациях немедленно обращайтесь в местные службы
                  экстренной помощи. Этот формат не заменяет живого
                  специалиста, но помогает структурировать мысли.
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px] font-medium text-slate-300">
                    ВЫБЕРИТЕ ГОЛОС ДЛЯ ЭТОЙ СЕССИИ
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isConnecting}
                      onClick={() => startCall("female")}
                      className="flex-1 bg-pink-500 hover:bg-pink-600 text-white rounded-full px-4 py-2 text-xs font-semibold"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Подключаемся...
                        </>
                      ) : (
                        "Начать с женским голосом"
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isConnecting}
                      onClick={() => startCall("male")}
                      className="flex-1 rounded-full border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 px-4 py-2 text-xs font-semibold"
                    >
                      Начать с мужским голосом
                    </Button>
                  </div>
                </div>

                {networkError && (
                  <div className="text-[11px] text-red-400">
                    {networkError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
