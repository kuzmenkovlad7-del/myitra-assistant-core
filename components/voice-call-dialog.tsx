"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Brain,
  Loader2,
  Mic,
  MicOff,
  Phone,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { APP_NAME } from "@/lib/app-config"

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
}

// основной вебхук TurbotaAI из env
const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

// запасной backend-роут
const FALLBACK_CHAT_API = "/api/chat"

// аккуратный парсер ответа n8n
function extractAnswer(data: any): string {
  if (!data) return ""

  if (typeof data === "string") {
    return data.trim()
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      (
        first.text ||
        first.response ||
        first.output ||
        first.message ||
        first.content ||
        first.result ||
        JSON.stringify(first)
      )
        ?.toString()
        ?.trim() || ""
    )
  }

  if (typeof data === "object") {
    return (
      (
        data.text ||
        data.response ||
        data.output ||
        data.message ||
        data.content ||
        data.result ||
        JSON.stringify(data)
      )
        ?.toString()
        ?.trim() || ""
    )
  }

  return ""
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
  const [connectionStatus, setConnectionStatus] =
    useState<"connected" | "disconnected">("disconnected")
  const [debugLines, setDebugLines] = useState<string[]>([])

  const voiceGenderRef = useRef<"female" | "male">("female")
  const micStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const ignoreChunksRef = useRef(false)
  const lastTranscriptRef = useRef<{ text: string; at: number } | null>(null)
  const lastAssistantUtteranceRef = useRef<string | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  function appendDebug(message: string) {
    const ts = new Date().toISOString()
    setDebugLines(prev => {
      const next = [...prev, `${ts} ${message}`]
      return next.slice(-200)
    })
  }

  useEffect(() => {
    appendDebug("ready; no events yet (debug log enabled временно)")
  }, [])

  // автоскролл вниз при новых сообщениях или логах
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, debugLines])

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function getLangReadable(): string {
    const code = computeLangCode()
    if (code.startsWith("uk")) return "Ukrainian"
    if (code.startsWith("ru")) return "Russian"
    return "English"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  async function requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === "undefined") {
      setNetworkError(
        t(
          "Microphone access is not available in this environment. Please open the assistant in a regular browser window.",
        ),
      )
      appendDebug("[getUserMedia] navigator is undefined")
      return false
    }

    const hasMediaDevices =
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function"

    if (!hasMediaDevices) {
      setNetworkError(
        t(
          "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
        ),
      )
      appendDebug("[getUserMedia] mediaDevices.getUserMedia not available")
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      micStreamRef.current = stream
      setNetworkError(null)
      appendDebug("[getUserMedia] access granted")
      return true
    } catch (error: any) {
      console.error("[Voice] getUserMedia error:", error)
      appendDebug(
        `[getUserMedia] error name=${error?.name || "unknown"} message=${
          error?.message || ""
        }`,
      )

      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked in the browser. Please allow access in the site permissions and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(
          t(
            "No microphone was found on this device. Please check your hardware.",
          ),
        )
      } else {
        setNetworkError(
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }

      return false
    }
  }

  function cleanupRecorder() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop()
        appendDebug("[Recorder] stop() called in cleanupRecorder()")
      } catch (e) {
        console.error("Error stopping MediaRecorder:", e)
        appendDebug("[Recorder] stop() error")
      }
    }
    recorderRef.current = null
  }

  function stopMicStream() {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
        } catch (e) {
          console.error("Error stopping mic track", e)
        }
      })
      micStreamRef.current = null
    }
  }

  function stopTtsAndAudio() {
    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      ;(window as any).speechSynthesis.cancel()
      appendDebug("[TTS] speechSynthesis.cancel()")
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // ignore
      }
      audioRef.current = null
    }
  }

  function stopEverything() {
    appendDebug("[CALL] stopEverything()")

    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false
    ignoreChunksRef.current = false

    setIsCallActive(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsListening(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)

    cleanupRecorder()
    stopMicStream()
    stopTtsAndAudio()
  }

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      stopEverything()
    }
  }, [])

  async function handleSttChunk(blob: Blob) {
    if (!isCallActiveRef.current) {
      appendDebug("[STT] chunk ignored (call inactive)")
      return
    }

    if (isAiSpeakingRef.current || ignoreChunksRef.current || isMicMutedRef.current) {
      appendDebug("[STT] chunk ignored (AI speaking or mic muted)")
      return
    }

    if (!blob || blob.size === 0) {
      appendDebug("[STT] empty blob, skipping")
      return
    }

    try {
      const langCode = computeLangCode()
      const file = new File([blob], `chunk-${Date.now()}.webm`, {
        type: blob.type || "audio/webm",
      })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("language", langCode)

      appendDebug(
        `[STT] sending chunk to /api/stt size=${blob.size} lang=${langCode}`,
      )

      const res = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      })

      const raw = await res.text()

      appendDebug(
        `[STT] response status=${res.status} ok=${res.ok} raw=${raw.slice(
          0,
          120,
        )}`,
      )

      if (!res.ok) {
        return
      }

      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      const text = (data?.text || "").toString().trim()
      if (!text) {
        appendDebug("[STT] no text in response")
        return
      }

      const now = Date.now()
      if (
        lastTranscriptRef.current &&
        lastTranscriptRef.current.text === text &&
        now - lastTranscriptRef.current.at < 4000
      ) {
        appendDebug(
          "[STT] transcript ignored as duplicate (likely echo, <4s window)",
        )
        return
      }

      if (lastAssistantUtteranceRef.current) {
        const a = lastAssistantUtteranceRef.current.toLowerCase()
        const tx = text.toLowerCase()
        if (a.includes(tx) || tx.includes(a)) {
          appendDebug(
            "[STT] transcript ignored as echo from AI voice (matches last assistant reply)",
          )
          return
        }
      }

      lastTranscriptRef.current = { text, at: now }

      appendDebug(`[STT] transcript: ${text}`)

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }

      setMessages(prev => [...prev, userMsg])

      await handleUserText(text)
    } catch (error: any) {
      console.error("[STT] error", error)
      appendDebug(
        `[STT] error message=${error?.message || String(error) || "unknown"}`,
      )
    }
  }

  function attachRecorder(stream: MediaStream) {
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      })
      recorderRef.current = recorder

      appendDebug(
        `[Recorder] MediaRecorder created mimeType=${recorder.mimeType}`,
      )

      recorder.onstart = () => {
        appendDebug("[Recorder] onstart")
        setIsListening(true)
      }

      recorder.onpause = () => {
        appendDebug("[Recorder] onpause")
        setIsListening(false)
      }

      recorder.onresume = () => {
        appendDebug("[Recorder] onresume")
        if (isCallActiveRef.current && !isMicMutedRef.current) {
          setIsListening(true)
        }
      }

      recorder.onstop = () => {
        appendDebug("[Recorder] onstop")
        setIsListening(false)
      }

      recorder.onerror = (event: any) => {
        console.error("[Recorder] error", event)
        appendDebug(
          `[Recorder] error name=${
            event?.error?.name || "unknown"
          } message=${event?.error?.message || ""}`,
        )
      }

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (!ev.data) return
        void handleSttChunk(ev.data)
      }

      recorder.start(4000)
      appendDebug("[Recorder] start(4000) called — chunk every 4s")
    } catch (error: any) {
      console.error("Cannot create MediaRecorder", error)
      appendDebug(
        `[Recorder] creation failed message=${
          error?.message || String(error) || "unknown"
        }`,
      )
      setNetworkError(
        t(
          "Could not start recording. Your browser might not support audio recording. Please use the latest Chrome or Safari.",
        ),
      )
    }
  }

  async function startCall(gender: "female" | "male") {
    voiceGenderRef.current = gender
    appendDebug(`[CALL] startCall gender=${gender}`)

    if (isCallActiveRef.current) {
      appendDebug("[CALL] already active, ignoring startCall()")
      return
    }

    setIsConnecting(true)
    setNetworkError(null)

    const micOk = await requestMicrophoneAccess()
    if (!micOk || !micStreamRef.current) {
      setIsConnecting(false)
      return
    }

    isCallActiveRef.current = true
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false
    ignoreChunksRef.current = false

    setIsCallActive(true)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setConnectionStatus("connected")

    attachRecorder(micStreamRef.current)
    setIsConnecting(false)
  }

  function endCall() {
    appendDebug("[CALL] endCall")
    stopEverything()
    onClose()
  }

  function toggleMic() {
    if (!isCallActiveRef.current || !recorderRef.current) {
      return
    }

    setIsMicMuted(prev => {
      const next = !prev
      isMicMutedRef.current = next

      const recorder = recorderRef.current

      if (!recorder) return next

      try {
        if (next) {
          if (recorder.state === "recording") {
            recorder.pause()
            appendDebug("[CALL] mic muted -> recorder.pause()")
          }
          ignoreChunksRef.current = true
          setIsListening(false)
        } else {
          ignoreChunksRef.current = false
          if (recorder.state === "paused") {
            recorder.resume()
            appendDebug("[CALL] mic unmuted -> recorder.resume()")
          }
          if (isCallActiveRef.current) {
            setIsListening(true)
          }
        }
      } catch (e) {
        console.error("Error toggling recorder", e)
        appendDebug("[Recorder] error while toggling pause/resume")
      }

      return next
    })
  }

  // ---------- озвучка ответа (OpenAI TTS + fallback) ----------
  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    lastAssistantUtteranceRef.current = cleanText

    appendDebug(
      `[TTS] speakText lang=${langCode} gender=${gender} sample=${cleanText.slice(
        0,
        80,
      )}`,
    )

    const beginSpeaking = () => {
      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true
      ignoreChunksRef.current = true
      setIsListening(false)
      appendDebug(
        "[TTS] beginSpeaking() -> ignoreChunksRef=true (stop sending STT chunks)",
      )
    }

    const finishSpeaking = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      ignoreChunksRef.current = false
      appendDebug("[TTS] finishSpeaking() -> ignoreChunksRef=false")

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        if (recorderRef.current && recorderRef.current.state === "paused") {
          try {
            recorderRef.current.resume()
            appendDebug("[Recorder] resume() after TTS")
          } catch (e) {
            console.error("Cannot resume recorder after TTS", e)
            appendDebug("[Recorder] resume() after TTS failed")
          }
        }
        setIsListening(true)
      }
    }

    const speakWithBrowserTTS = () => {
      const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined
      if (!synth) {
        console.warn("[TTS] Browser speechSynthesis is not available")
        appendDebug("[TTS] browser speechSynthesis not available")
        finishSpeaking()
        return
      }

      appendDebug("[TTS] Using browser speechSynthesis fallback")

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = langCode
      utterance.rate = 1
      utterance.pitch = gender === "MALE" ? 0.9 : 1.1

      utterance.onstart = () => {
        appendDebug("[TTS] browser utterance.onstart")
        beginSpeaking()
      }

      utterance.onend = () => {
        appendDebug("[TTS] browser utterance.onend")
        finishSpeaking()
      }

      utterance.onerror = e => {
        console.error("[TTS] Browser TTS error", e)
        appendDebug("[TTS] browser utterance.onerror")
        finishSpeaking()
      }

      synth.cancel()
      synth.speak(utterance)
    }

    ;(async () => {
      try {
        const payload = {
          text: cleanText,
          language: langCode,
          gender,
        }

        appendDebug("[TTS] Requesting /api/tts…")

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        const raw = await res.text()
        let data: any = null

        try {
          data = raw ? JSON.parse(raw) : null
        } catch (e) {
          console.error(
            "[TTS] /api/tts returned non-JSON response:",
            raw.slice(0, 200),
          )
          appendDebug(
            `[TTS] /api/tts non-JSON status=${res.status} body=${raw.slice(
              0,
              120,
            )}`,
          )
        }

        appendDebug(
          `[TTS] /api/tts status=${res.status} ok=${res.ok} success=${
            data?.success
          }`,
        )

        if (!res.ok || !data || data.success === false) {
          console.error(
            "[TTS] API error",
            data?.error || res.statusText,
            data?.details || "",
          )
          speakWithBrowserTTS()
          return
        }

        let audioUrl: string | undefined = data.audioUrl
        if (!audioUrl && data.audioContent) {
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        }

        if (!audioUrl) {
          console.error("[TTS] No audioUrl/audioContent in response")
          appendDebug("[TTS] no audioUrl/audioContent in response")
          speakWithBrowserTTS()
          return
        }

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

        audio.onplay = () => {
          appendDebug("[TTS] audio.onplay")
          beginSpeaking()
          if (recorderRef.current && recorderRef.current.state === "recording") {
            try {
              recorderRef.current.pause()
              appendDebug("[Recorder] pause() while TTS audio is playing")
            } catch (e) {
              console.error("Cannot pause recorder while TTS plays", e)
              appendDebug("[Recorder] pause() during TTS failed")
            }
          }
        }

        audio.onended = () => {
          appendDebug("[TTS] audio.onended")
          audioRef.current = null
          finishSpeaking()
        }

        audio.onerror = e => {
          console.error("[TTS] audio playback error:", e)
          appendDebug("[TTS] audio.onerror")
          audioRef.current = null
          finishSpeaking()
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          appendDebug("[TTS] audio.play() rejected, fallback to browser TTS")
          speakWithBrowserTTS()
        }
      } catch (error) {
        console.error("[TTS] fetch error:", error)
        appendDebug("[TTS] fetch error, fallback to browser TTS")
        speakWithBrowserTTS()
      }
    })()
  }

  // ---------- отправка текста в n8n/OpenAI ----------
  async function handleUserText(text: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    appendDebug(
      `[CHAT] sending to ${resolvedWebhook} lang=${langCode} gender=${voiceGenderRef.current}`,
    )

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      } catch {
        // строка — оставляем как есть
      }

      appendDebug(
        `[CHAT] response status=${res.status} ok=${res.ok} bodySample=${raw.slice(
          0,
          160,
        )}`,
      )

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`)
      }

      let answer = extractAnswer(data)

      if (!answer) {
        answer = t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )
      }

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
      }

      setMessages(prev => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      console.error("Voice call error:", error)
      appendDebug(
        `[CHAT] error message=${
          error?.message || String(error) || "unknown"
        }`,
      )
      setNetworkError(
        t(
          "Connection error. Please check your internet connection and try again.",
        ),
      )
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      endCall()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="w-[min(100vw-1rem,480px)] max-h-[calc(100vh-3rem)] overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-2xl">
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500 px-5 pt-5 pb-4 text-white">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <Phone className="h-5 w-5" />
                </span>
                <span>
                  Голосова сесія з AI-психологом
                </span>
              </DialogTitle>
              <DialogDescription className="text-sm text-white/80">
                Ви можете говорити вголос — асистент слухатиме, відповідатиме й
                озвучуватиме відповіді.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                  <Brain className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <div className="font-medium">TurbotaAI · Асистент онлайн</div>
                  <div className="flex items-center gap-1 text-[11px] text-white/80">
                    {connectionStatus === "connected" ? (
                      <>
                        <Wifi className="h-3 w-3" />
                        <span>Підключено · {getLangReadable()}</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3" />
                        <span>Очікування підключення…</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-full bg-white/15 px-3 py-1 text-[11px]">
                {APP_NAME}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-white px-4 pb-3 pt-4">
            {networkError && (
              <div className="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {networkError}
              </div>
            )}

            {!hasMessages && !networkError && (
              <div className="mb-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <div className="font-semibold mb-1">Як це працює</div>
                <p>
                  Оберіть голос і розпочніть сесію. Асистент слухатиме вас і
                  відповідатиме, як справжній психолог. Ви можете перемикатися
                  між жіночим і чоловічим голосом, завершивши дзвінок і
                  розпочавши новий з іншим варіантом.
                </p>
              </div>
            )}

            <div className="flex-1 min-h-0 rounded-2xl bg-slate-900 text-xs text-slate-50">
              <div className="border-b border-slate-800 px-3 py-2 text-[11px] font-medium text-slate-300">
                Debug:
              </div>
              <ScrollArea className="h-40">
                <div
                  ref={scrollRef}
                  className="max-h-40 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
                >
                  {debugLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              У кризових ситуаціях негайно зверніться до місцевих служб
              екстреної допомоги.
            </div>

            {!isCallActive && (
              <div className="mt-3 space-y-2">
                <div className="text-center text-xs font-semibold text-slate-600">
                  ОБЕРІТЬ ГОЛОС ДЛЯ ЦІЄЇ СЕСІЇ
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    disabled={isConnecting}
                    onClick={() => startCall("female")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 text-sm font-semibold text-white hover:bg-pink-500/90"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span>Почати з жіночим голосом</span>
                  </Button>
                  <Button
                    disabled={isConnecting}
                    onClick={() => startCall("male")}
                    variant="outline"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-sky-300 bg-sky-50 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    <span>Почати з чоловічим голосом</span>
                  </Button>
                </div>
              </div>
            )}

            {isCallActive && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      {isAiSpeaking ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </span>
                    <div className="leading-tight text-[11px] text-slate-700">
                      {isAiSpeaking ? (
                        <div>
                          AI is speaking ({getCurrentGender() === "FEMALE"
                            ? "Female"
                            : "Male"}{" "}
                          ) in {getLangReadable()}…
                        </div>
                      ) : isListening && !isMicMuted ? (
                        <div>
                          Асистент слухає… Ви можете почати говорити в будь-який
                          момент.
                        </div>
                      ) : isMicMuted ? (
                        <div>Мікрофон вимкнено. Увімкніть, щоб продовжити.</div>
                      ) : (
                        <div>Очікування… Ви можете почати говорити в будь-який момент.</div>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
                    <Button
                      type="button"
                      onClick={toggleMic}
                      variant={isMicMuted ? "outline" : "secondary"}
                      className="flex-1 rounded-full sm:flex-none sm:w-11 h-11 px-0"
                    >
                      {isMicMuted ? (
                        <MicOff className="h-5 w-5 text-slate-700" />
                      ) : (
                        <Mic className="h-5 w-5 text-emerald-600" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={endCall}
                      className="flex-1 rounded-full bg-red-500 hover:bg-red-600 sm:flex-none sm:w-11 h-11 px-0"
                    >
                      <Phone className="h-5 w-5 rotate-135" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
