"use client"

import { useEffect, useRef, useState } from "react"
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
  X,
  Phone,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Brain,
  Sparkles,
  Loader2,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { getLocaleForLanguage } from "@/lib/i18n/translation-utils"
import { generateGoogleTTS } from "@/lib/google-tts"

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  idleVideo?: string
  speakingVideo?: string
}

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}

const VIDEO_CALL_VOICE_CONFIGS: any = {
  uk: {
    female: { languageCode: "uk-UA", name: "uk-UA-Standard-A", ssmlGender: "FEMALE" },
    male: { languageCode: "uk-UA", name: "uk-UA-Chirp3-HD-Schedar", ssmlGender: "MALE" },
  },
  ru: {
    female: { languageCode: "ru-RU", name: "ru-RU-Standard-A", ssmlGender: "FEMALE" },
    male: { languageCode: "ru-RU", name: "ru-RU-Standard-B", ssmlGender: "MALE" },
  },
  en: {
    female: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
    male: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
  },
}

const AI_CHARACTERS: AICharacter[] = [
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description:
      "Старший психолог, специализация: когнитивно-поведенческая терапия, большой опыт работы с тревогой и стрессом.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
  },
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description:
      "Клинический психолог, специализация: тревога, депрессия, стресс на работе. Бережный и структурный подход.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description:
      "Психотерапевт, специализация: эмоциональная регуляция, травма, отношения. Подходит для глубокой работы.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9963-sneJ4XhoEuemkYgVb425Mscu7X9OC6.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
  },
]

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.output ||
      first.text ||
      first.response ||
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
      data.text ||
      data.response ||
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

function cleanText(text: string): string {
  if (!text) return ""
  return text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/```/g, "")
    .trim()
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
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const langCode =
    typeof (currentLanguage as any) === "string"
      ? ((currentLanguage as any) as string)
      : (currentLanguage as any)?.code || "uk"

  const locale = getLocaleForLanguage(langCode)
  const languageDisplayName =
    (currentLanguage as any)?.name ||
    (langCode.startsWith("ru") ? "Russian" : langCode.startsWith("uk") ? "Ukrainian" : "English")
  const languageFlag = (currentLanguage as any)?.flag || "🌍"

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(AI_CHARACTERS[1] || AI_CHARACTERS[0])
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [errorText, setErrorText] = useState<string | null>(null)

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  
  const ignoreSttUntilRef = useRef(0)
const isCallActiveRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  const stopCurrentSpeech = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      audioRef.current = null
    }
    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {}
    }
  }

  const pauseRecorderForTts = () => {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "recording") {
      try {
        rec.pause()
      } catch {}
    }
  }

  const resumeRecorderAfterTts = () => {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "paused" && isCallActiveRef.current && !isMicMuted) {
      try {
        rec.resume()
      } catch {}
    }
  }

  const speakText = async (text: string) => {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return
    const cleaned = cleanText(text)
    if (!cleaned) return

    stopCurrentSpeech()
    pauseRecorderForTts()

    // iOS/Safari: глушим STT во время озвучки и немного после
    ignoreSttUntilRef.current = Date.now() + 2500

    setIsAiSpeaking(true)

    if (selectedCharacter?.speakingVideo && speakingVideoRef.current) {
      try {
        speakingVideoRef.current.currentTime = 0
        await speakingVideoRef.current.play()
      } catch {}
    }

    const finish = () => {
      setIsAiSpeaking(false)
      if (selectedCharacter?.speakingVideo && speakingVideoRef.current) {
        try {
          speakingVideoRef.current.pause()
          speakingVideoRef.current.currentTime = 0
        } catch {}
      }
      if (selectedCharacter?.idleVideo && idleVideoRef.current && isCallActiveRef.current) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }
      ignoreSttUntilRef.current = Date.now() + 1500
      resumeRecorderAfterTts()
    }

    try {
      let usedGoogle = false
      try {
        const audioDataUrl = await generateGoogleTTS(cleaned, locale, selectedCharacter.gender)

        if (audioDataUrl) {
          usedGoogle = true
          await new Promise<void>((resolve) => {
            const a = new Audio(audioDataUrl)
            audioRef.current = a
            a.setAttribute("playsinline","true");
            a.setAttribute("webkit-playsinline","true");a.onended = () => resolve()
            a.onerror = () => resolve()
            a.play().catch(() => resolve())
          })
        }
      } catch {}

      if (!usedGoogle) {
        // fallback: web speech synthesis
        if (typeof window !== "undefined" && (window as any).speechSynthesis) {
          await new Promise<void>((resolve) => {
            try {
              const u = new SpeechSynthesisUtterance(cleaned)
              u.lang = locale
              u.onend = () => resolve()
              u.onerror = () => resolve()
              ;(window as any).speechSynthesis.speak(u)
            } catch {
              resolve()
            }
          })
        }
      }
    } finally {
      finish()
    }
  }

  async function handleUserText(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg: ChatMessage = { id: `${Date.now()}-user`, role: "user", text: trimmed }
    setMessages((p) => [...p, userMsg])

    setErrorText(null)

    try {
      const res = await fetch(VIDEO_ASSISTANT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          language: langCode,
          email: user?.email || "guest@example.com",
          mode: "video",
          characterId: selectedCharacter.id,
          gender: selectedCharacter.gender,
        }),
      })

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      const answerRaw = extractAnswer(data)
      const answer = cleanText(answerRaw) || t("I'm sorry, I couldn't process your message. Please try again.")
      const aiMsg: ChatMessage = { id: `${Date.now()}-assistant`, role: "assistant", text: answer }
      setMessages((p) => [...p, aiMsg])

      await speakText(answer)
    } catch (e: any) {
      console.error(e)
      const msg = t("Connection error. Please try again.")
      setErrorText(msg)
      if (onError && e instanceof Error) onError(e)
    }
  }

  async function maybeSendStt() {
    if (!isCallActiveRef.current) return
    if (isSttBusyRef.current) return
    if (!audioChunksRef.current.length) return

    
    // анти-эхо (особенно iOS Safari)
    if (Date.now() < ignoreSttUntilRef.current) return
    if (isAiSpeaking) return
    if (isMicMuted) return
const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" })
    if (blob.size < 8000) return

    try {
      isSttBusyRef.current = true

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "x-lang": langCode,
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
        console.error("[STT] error", res.status, raw)
        return
      }

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) return

      // если ассистент сейчас говорит — не отправляем (чтобы не ловить эхо)
      if (isAiSpeaking) return
      if (isMicMuted) return

      await handleUserText(delta)
    } catch (e) {
      console.error("[STT] fatal", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  const startRecording = (stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") {
      setErrorText(
        t("Microphone recording is not supported in this browser. Please use the latest Chrome/Edge/Safari."),
      )
      return false
    }

    // берём только audio track (чтобы управлять записью независимо от видео)
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) {
      setErrorText(t("No microphone was found on this device. Please check your hardware."))
      return false
    }

    const audioOnlyStream = new MediaStream([audioTrack])
    audioStreamRef.current = audioOnlyStream

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/mpeg",
    ]

    const options: MediaRecorderOptions = {}
    if (typeof MediaRecorder !== "undefined" && (MediaRecorder as any).isTypeSupported) {
      for (const c of candidates) {
        try {
          if ((MediaRecorder as any).isTypeSupported(c)) {
            options.mimeType = c
            break
          }
        } catch {}
      }
    }

    const rec = new MediaRecorder(audioOnlyStream, options)
    mediaRecorderRef.current = rec
    audioChunksRef.current = []
    isSttBusyRef.current = false
    lastTranscriptRef.current = ""

    rec.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) {
        audioChunksRef.current.push(ev.data)
        void maybeSendStt()
      }
    }

    rec.onerror = (ev: any) => {
      console.error("[Recorder] error", ev)
    }

    try {
      rec.start(4000) // каждые 4 сек
      return true
    } catch (e) {
      console.error(e)
      setErrorText(t("Could not start microphone. Check permissions and try again."))
      return false
    }
  }

  const startCall = async () => {
    setIsConnecting(true)
    setErrorText(null)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setErrorText(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."),
        )
        setIsConnecting(false)
        return
      }

      stopCurrentSpeech()

      // запрос разрешений — строго по клику
      const constraints: any = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isCameraOff ? false : { facingMode: "user" },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      mediaStreamRef.current = stream

      if (!isCameraOff && userVideoRef.current) {
        userVideoRef.current.srcObject = stream
      }

      const ok = startRecording(stream)
      if (!ok) {
        // если запись не стартанула — не падаем приложением
        setIsConnecting(false)
        return
      }

      setIsCallActive(true)
      isCallActiveRef.current = true
      setMessages([])
      setIsMicMuted(false)

      if (selectedCharacter?.idleVideo && idleVideoRef.current) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }
    } catch (error: any) {
      console.error(error)
      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorText(
          t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."),
        )
      } else {
        setErrorText(
          t("Could not start microphone/camera. Check permissions in the browser and system settings, then try again."),
        )
      }

      setIsCallActive(false)
      isCallActiveRef.current = false
    } finally {
      setIsConnecting(false)
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setErrorText(null)
    setMessages([])
    lastTranscriptRef.current = ""
    audioChunksRef.current = []
    isSttBusyRef.current = false

    stopCurrentSpeech()

    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try { rec.stop() } catch {}
    }
    mediaRecorderRef.current = null

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((tr) => {
        try { tr.stop() } catch {}
      })
      audioStreamRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => {
        try { tr.stop() } catch {}
      })
      mediaStreamRef.current = null
    }

    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null
    }

    if (idleVideoRef.current) {
      try { idleVideoRef.current.pause(); idleVideoRef.current.currentTime = 0 } catch {}
    }
    if (speakingVideoRef.current) {
      try { speakingVideoRef.current.pause(); speakingVideoRef.current.currentTime = 0 } catch {}
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try { rec.pause() } catch {}
      }
    } else {
      if (rec.state === "paused" && isCallActiveRef.current && !isAiSpeaking) {
        try { rec.resume() } catch {}
      }
    }
  }

  const toggleCamera = async () => {
    const next = !isCameraOff
    setIsCameraOff(next)

    const stream = mediaStreamRef.current
    if (!stream) return

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !next
    }

    if (next) {
      // выключаем превью
      if (userVideoRef.current) userVideoRef.current.srcObject = null
    } else {
      // включаем превью
      if (userVideoRef.current) userVideoRef.current.srcObject = stream
    }
  }

  const toggleSound = () => {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      stopCurrentSpeech()
      setIsAiSpeaking(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const statusText = !isCallActive
    ? t("Choose an AI psychologist and start the video call.")
    : isAiSpeaking
      ? t("Assistant is speaking...")
      : isMicMuted
        ? t("Paused. Turn on microphone to continue.")
        : t("Listening… you can speak.")

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
      <DialogContent className="max-w-4xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t("Video call with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("Video session in {{language}}", { language: languageDisplayName })} · {languageFlag}
                </DialogDescription>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  endCall()
                  onClose()
                }}
                className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/40"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex h-[560px] flex-col md:h-[620px]">
            {!isCallActive ? (
              <>
                <div className="px-6 pt-5 pb-3">
                  <h3 className="text-2xl font-semibold text-slate-900">{t("Choose Your AI Psychologist")}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {t("Select the AI psychologist you'd like to speak with during your video call.")}
                  </p>

                  <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-center">
                    <div className="text-xs font-semibold text-sky-700">{t("Video call language")}:</div>
                    <div className="mt-1 inline-flex items-center justify-center gap-2 text-lg font-semibold text-sky-900">
                      <span>{languageFlag}</span>
                      <span>{languageDisplayName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 px-6 pb-4">
                  <ScrollArea className="h-full pr-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {AI_CHARACTERS.map((c) => {
                        const isSelected = selectedCharacter.id === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCharacter(c)}
                            className={[
                              "rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition hover:shadow-md",
                              isSelected ? "border-indigo-500" : "border-slate-200",
                            ].join(" ")}
                          >
                            <div className="relative mb-3 aspect-[3/2] w-full overflow-hidden rounded-xl bg-slate-900">
                              {c.idleVideo ? (
                                <video
                                  className="absolute inset-0 h-full w-full object-cover"
                                  muted
                                  loop
                                  playsInline
                                  autoPlay
                                  preload="auto"
                                >
                                  <source src={c.idleVideo} type="video/mp4" />
                                </video>
                              ) : (
                                <Image
                                  src={c.avatar || "/placeholder.svg"}
                                  alt={c.name}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 100vw, 33vw"
                                />
                              )}
                            </div>

                            <div className="text-base font-semibold text-slate-900">{c.name}</div>
                            <div className="mt-1 text-sm text-slate-600">{c.description}</div>

                            <div className="mt-4">
                              <span
                                className={[
                                  "inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-xs font-semibold",
                                  isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700",
                                ].join(" ")}
                              >
                                {isSelected ? t("Selected") : t("Select")}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t border-slate-100 px-6 py-4">
                  {errorText && (
                    <div className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {errorText}
                    </div>
                  )}

                  <Button
                    onClick={() => void startCall()}
                    disabled={isConnecting}
                    className="h-12 w-full rounded-full bg-indigo-600 text-base font-semibold text-white hover:bg-indigo-700"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("Connecting")}
                      </>
                    ) : (
                      <>
                        {t("Start Video Call")}
                        <Phone className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 px-6 pt-4 pb-2">
                  <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-5">
                    {/* video */}
                    <div className="relative overflow-hidden rounded-2xl bg-slate-900 md:col-span-3">
                      {selectedCharacter.idleVideo && (
                        <video
                          ref={idleVideoRef}
                          className="absolute inset-0 h-full w-full object-cover"
                          muted
                          loop
                          playsInline
                          autoPlay
                          preload="auto"
                        >
                          <source src={selectedCharacter.idleVideo} type="video/mp4" />
                        </video>
                      )}

                      {selectedCharacter.speakingVideo && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                            isAiSpeaking ? "opacity-100" : "opacity-0"
                          }`}
                          muted
                          loop
                          playsInline
                          autoPlay
                          preload="auto"
                        >
                          <source src={selectedCharacter.speakingVideo} type="video/mp4" />
                        </video>
                      )}

                      {!isCameraOff && (
                        <div className="absolute bottom-3 right-3 h-24 w-36 overflow-hidden rounded-xl bg-black shadow-lg">
                          <video
                            ref={userVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}

                      <div className="absolute top-3 right-3 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-900">
                        {statusText}
                      </div>
                    </div>

                    {/* chat */}
                    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white md:col-span-2">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Brain className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{selectedCharacter.name}</div>
                            <div className="text-xs text-slate-500 truncate">{statusText}</div>
                          </div>
                        </div>
                      </div>

                      <ScrollArea className="flex-1 px-4 py-3">
                        <div ref={scrollRef} className="space-y-3 pr-2">
                          {messages.length === 0 && (
                            <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-sm text-slate-700">
                              <div className="font-semibold text-slate-900">{t("How it works")}</div>
                              <div className="mt-1">
                                {t("You can start speaking when you're ready. The assistant will answer with voice and text here.")}
                              </div>
                            </div>
                          )}

                          {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div
                                className={[
                                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                                  m.role === "user"
                                    ? "bg-slate-900 text-white rounded-br-sm"
                                    : "bg-slate-50 text-slate-900 rounded-bl-sm",
                                ].join(" ")}
                              >
                                {m.text}
                              </div>
                            </div>
                          ))}

                          {errorText && (
                            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                              {errorText}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>

                {/* controls */}
                <div className="border-t border-slate-100 px-6 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Sparkles className="h-4 w-4" />
                      {statusText}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        onClick={toggleMic}
                        className={[
                          "h-11 w-11 rounded-full border",
                          isMicMuted
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700",
                        ].join(" ")}
                      >
                        {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        onClick={() => void toggleCamera()}
                        className={[
                          "h-11 w-11 rounded-full border",
                          isCameraOff
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                        ].join(" ")}
                      >
                        {isCameraOff ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        onClick={toggleSound}
                        className={[
                          "h-11 w-11 rounded-full border",
                          isSoundEnabled
                            ? "border-slate-200 bg-slate-50 text-slate-700"
                            : "border-rose-200 bg-rose-50 text-rose-600",
                        ].join(" ")}
                      >
                        {isSoundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        onClick={endCall}
                        className="h-11 w-11 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <Phone className="h-5 w-5 rotate-[135deg]" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
