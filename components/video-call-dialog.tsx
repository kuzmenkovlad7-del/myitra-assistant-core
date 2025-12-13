"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Loader2,
  X,
  Sparkles,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

type Props = {
  isOpen: boolean
  onClose: () => void
  onError?: (e: Error) => void
  userEmail?: string
  webhookUrl?: string
}

type Msg = { id: string; role: "user" | "assistant"; text: string }

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

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
    )?.toString().trim()
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
    )?.toString().trim()
  }
  return ""
}

function diffTranscript(prev: string, full: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  full = full.trim()
  if (!full) return ""
  if (!prev) return full

  const prevNorm = normalize(prev)
  const fullNorm = normalize(full)
  if (!prevNorm || !fullNorm) return full

  const prevWords = prevNorm.split(" ")
  const fullWords = fullNorm.split(" ")
  const maxCommon = Math.min(prevWords.length, fullWords.length)

  let common = 0
  while (common < maxCommon && prevWords[common] === fullWords[common]) common++

  if (common === 0) return full

  const rawTokens = full.split(/\s+/)
  if (common >= rawTokens.length) return ""
  return rawTokens.slice(common).join(" ").trim()
}

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: Props) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const [step, setStep] = useState<"choose" | "call">("choose")
  const [selectedId, setSelectedId] = useState<"alex" | "sophia" | "maria">(
    "sophia",
  )

  const [isConnecting, setIsConnecting] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [messages, setMessages] = useState<Msg[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const userStreamRef = useRef<MediaStream | null>(null)

  // STT recorder refs (как в голосовом)
  const sttRecorderRef = useRef<MediaRecorder | null>(null)
  const sttChunksRef = useRef<Blob[]>([])
  const sttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const assistants = useMemo(
    () => ({
      alex: {
        id: "alex" as const,
        name: "Dr. Alexander",
        desc: t(
          "Senior psychologist specializing in CBT, with 15+ years of experience.",
        ),
        gender: "male" as const,
        img: "/assistants/alexander.jpg",
      },
      sophia: {
        id: "sophia" as const,
        name: "Dr. Sophia",
        desc: t(
          "Clinical psychologist specializing in anxiety, depression and stress management at work.",
        ),
        gender: "female" as const,
        img: "/assistants/sophia.jpg",
      },
      maria: {
        id: "maria" as const,
        name: "Dr. Maria",
        desc: t(
          "Psychotherapist specializing in emotional regulation, trauma recovery and relationship work.",
        ),
        gender: "female" as const,
        img: "/assistants/maria.jpg",
      },
    }),
    [t],
  )

  const selected = assistants[selectedId]

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function langCodeShort(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"
    if (lang.startsWith("ru")) return "ru"
    if (lang.startsWith("uk")) return "uk"
    return "en"
  }

  function langForTts(): string {
    const l = langCodeShort()
    if (l === "ru") return "ru-RU"
    if (l === "uk") return "uk-UA"
    return "en-US"
  }

  function mimeForRecorder(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/m4a",
    ]
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c
      } catch {}
    }
    return undefined
  }

  async function maybeSendSttChunk() {
    if (!isCallActive) return
    if (sttBusyRef.current) return
    if (!sttChunksRef.current.length) return

    try {
      sttBusyRef.current = true

      const mime = sttRecorderRef.current?.mimeType || "audio/webm"
      const blob = new Blob(sttChunksRef.current, { type: mime })
      sttChunksRef.current = []

      if (blob.size < 8000) return

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
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
        setStatusError(
          t("Could not transcribe your speech. Please try again."),
        )
        return
      }

      const fullText = String(data.text || "").trim()
      if (!fullText) return

      const delta = diffTranscript(lastTranscriptRef.current, fullText)
      lastTranscriptRef.current = fullText
      if (!delta) return

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-u`, role: "user", text: delta },
      ])

      await sendToAgent(delta)
    } finally {
      sttBusyRef.current = false
    }
  }

  async function sendToAgent(text: string) {
    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    const lang = langCodeShort()

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: lang,
          email: effectiveEmail,
          mode: "video",
          character: selected.name,
          gender: selected.gender,
          voiceLanguage: langForTts(),
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      let answer = extractAnswer(data)
      if (!answer) {
        answer = t("I'm sorry, I couldn't process your message. Please try again.")
      }

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: "assistant", text: answer },
      ])

      if (isSoundEnabled) {
        void speak(answer)
      }
    } catch (e: any) {
      setStatusError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
  }

  async function speak(text: string) {
    const clean = text.trim()
    if (!clean) return

    const pauseStt = () => {
      const rec = sttRecorderRef.current
      if (rec && rec.state === "recording") {
        try { rec.pause() } catch {}
      }
    }
    const resumeStt = () => {
      const rec = sttRecorderRef.current
      if (rec && rec.state === "paused" && isCallActive && !isMicMuted) {
        try { rec.resume() } catch {}
      }
    }

    try {
      setIsAiSpeaking(true)
      pauseStt()

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          language: langForTts(),
          gender: selected.gender === "male" ? "MALE" : "FEMALE",
        }),
      })

      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = null }

      if (!res.ok || !data || data.success === false || !data.audioContent) {
        setIsAiSpeaking(false)
        resumeStt()
        return
      }

      const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

      if (audioRef.current) {
        try { audioRef.current.pause() } catch {}
        audioRef.current = null
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsAiSpeaking(false)
        audioRef.current = null
        resumeStt()
      }
      audio.onerror = () => {
        setIsAiSpeaking(false)
        audioRef.current = null
        resumeStt()
      }

      try {
        await audio.play()
      } catch {
        setIsAiSpeaking(false)
        audioRef.current = null
        resumeStt()
      }
    } catch {
      setIsAiSpeaking(false)
    }
  }

  async function startCall() {
    setStatusError(null)
    setIsConnecting(true)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatusError(
          t(
            "Microphone/camera access is not supported in this browser. Please use the latest Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setStatusError(t("Microphone requires HTTPS. Please open the website over https."))
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      userStreamRef.current = stream

      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream
        try {
          await userVideoRef.current.play()
        } catch {}
      }

      // STT recorder: audio only stream
      const audioTracks = stream.getAudioTracks()
      const audioStream = new MediaStream(audioTracks)

      const mime = mimeForRecorder()
      const recorder = new MediaRecorder(
        audioStream,
        mime ? ({ mimeType: mime } as any) : undefined,
      )

      sttRecorderRef.current = recorder
      sttChunksRef.current = []
      sttBusyRef.current = false
      lastTranscriptRef.current = ""

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          sttChunksRef.current.push(e.data)
          void maybeSendSttChunk()
        }
      }

      recorder.onerror = () => {
        setStatusError(t("Could not start microphone. Check permissions and try again."))
      }

      recorder.start(3500)

      setIsCallActive(true)
      setStep("call")
      setIsConnecting(false)
    } catch (e: any) {
      const name = e?.name || ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatusError(
          t("Microphone/camera is blocked for this site. Allow access in the address bar and reload the page."),
        )
      } else {
        setStatusError(t("Could not start camera/microphone. Please try again."))
      }
      setIsConnecting(false)
    }
  }

  function stopAll() {
    setIsConnecting(false)
    setIsAiSpeaking(false)
    setIsMicMuted(false)
    setIsCameraOff(false)
    setIsSoundEnabled(true)
    setIsCallActive(false)
    setStatusError(null)
    lastTranscriptRef.current = ""
    sttChunksRef.current = []
    sttBusyRef.current = false

    const rec = sttRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try { rec.stop() } catch {}
    }
    sttRecorderRef.current = null

    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((tr) => {
        try { tr.stop() } catch {}
      })
      userStreamRef.current = null
    }

    if (audioRef.current) {
      try { audioRef.current.pause() } catch {}
      audioRef.current = null
    }

    setMessages([])
    setStep("choose")
  }

  function handleClose() {
    stopAll()
    onClose()
  }

  function toggleMic() {
    const next = !isMicMuted
    setIsMicMuted(next)

    const stream = userStreamRef.current
    if (stream) {
      stream.getAudioTracks().forEach((tr) => (tr.enabled = !next))
    }

    const rec = sttRecorderRef.current
    if (rec) {
      if (next && rec.state === "recording") {
        try { rec.pause() } catch {}
      }
      if (!next && rec.state === "paused" && isCallActive) {
        try { rec.resume() } catch {}
      }
    }
  }

  function toggleCamera() {
    const next = !isCameraOff
    setIsCameraOff(next)
    const stream = userStreamRef.current
    if (stream) {
      stream.getVideoTracks().forEach((tr) => (tr.enabled = next ? false : true))
    }
  }

  function toggleSound() {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next && audioRef.current) {
      try { audioRef.current.pause() } catch {}
      audioRef.current = null
      setIsAiSpeaking(false)
    }
  }

  function endCall() {
    stopAll()
  }

  useEffect(() => {
    if (!isOpen) stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const headerTitle =
    step === "choose" ? t("Video call with AI-psychologist") : t("Video call with AI-psychologist")

  const headerDesc =
    step === "choose"
      ? t("Video session in ") + (langCodeShort() === "ru" ? "Russian" : langCodeShort() === "uk" ? "Ukrainian" : "English")
      : t("Tap microphone to record a short message.")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl border-none bg-transparent p-0 [&>button]:hidden">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {headerTitle}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {headerDesc}
                </DialogDescription>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label={t("Close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {step === "choose" ? (
            <div className="px-5 py-5">
              <div className="flex flex-col items-center gap-2 pb-4">
                <div className="text-xs font-semibold text-slate-600">
                  {t("Video call language")}:
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {langCodeShort() === "ru" ? "🇷🇺 Russian" : langCodeShort() === "uk" ? "🇺🇦 Ukrainian" : "🇺🇸 English"}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {(Object.values(assistants) as any[]).map((a) => {
                  const active = a.id === selectedId
                  return (
                    <div
                      key={a.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                        active ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
                      }`}
                    >
                      <div className="overflow-hidden rounded-2xl bg-slate-100">
                        <img
                          src={a.img}
                          alt={a.name}
                          className="h-44 w-full object-cover"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = "none"
                          }}
                        />
                        <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                          {a.name}
                        </div>
                      </div>

                      <div className="pt-3 text-center">
                        <div className="text-base font-semibold text-slate-900">{a.name}</div>
                        <div className="mt-2 text-sm text-slate-600">{a.desc}</div>

                        <Button
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className={`mt-4 w-full rounded-full ${
                            active
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                          }`}
                        >
                          {active ? t("Selected") : t("Choose")}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {statusError && (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {statusError}
                </div>
              )}

              <div className="pt-5">
                <Button
                  type="button"
                  onClick={() => void startCall()}
                  disabled={isConnecting}
                  className="h-14 w-full rounded-2xl bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("Connecting")}
                    </>
                  ) : (
                    t("Start video call")
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={userVideoRef}
                    muted
                    playsInline
                    className="h-[340px] w-full object-cover md:h-[420px]"
                  />
                  {!isMicMuted && !isAiSpeaking && (
                    <div className="absolute right-3 top-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {t("Listening…")}
                    </div>
                  )}
                  {isAiSpeaking && (
                    <div className="absolute right-3 top-3 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                      {t("Assistant is speaking...")}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-center space-x-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`rounded-full h-14 w-14 touch-manipulation ${
                      isMicMuted ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                    }`}
                    onClick={toggleMic}
                    aria-label={t("Microphone")}
                  >
                    {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className={`rounded-full h-14 w-14 touch-manipulation ${
                      isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"
                    }`}
                    onClick={toggleCamera}
                    aria-label={t("Camera")}
                  >
                    {isCameraOff ? <CameraOff className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className={`rounded-full h-14 w-14 touch-manipulation ${
                      isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"
                    }`}
                    onClick={toggleSound}
                    aria-label={t("Sound")}
                  >
                    {isSoundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                  </Button>

                  <Button
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-14 w-14 bg-red-600 hover:bg-red-700 text-white touch-manipulation"
                    onClick={endCall}
                    aria-label={t("End call")}
                  >
                    <Phone className="h-6 w-6 rotate-[135deg]" />
                  </Button>
                </div>

                {statusError && (
                  <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {statusError}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    {selected.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {t("The assistant replies here in text (and voice, if enabled).")}
                  </div>
                </div>

                <ScrollArea className="h-[420px] px-4 py-3">
                  <div ref={scrollRef} className="space-y-3 pr-1">
                    {messages.length === 0 && (
                      <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                        <p className="font-medium text-slate-900">{t("How to start")}</p>
                        <p className="mt-1">
                          {t("Tap microphone and say one sentence about what you feel right now.")}
                        </p>
                      </div>
                    )}

                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs md:text-sm ${
                            m.role === "user"
                              ? "rounded-br-sm bg-slate-900 text-white shadow-sm"
                              : "rounded-bl-sm bg-slate-50 text-slate-900 shadow-sm"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
