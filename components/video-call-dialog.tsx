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
import { Phone, Video, Mic, MicOff, Camera, CameraOff, Loader2, Sparkles, Brain } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
  webhookUrl?: string
}

type Role = "user" | "assistant"
type Gender = "female" | "male"

type VideoMessage = {
  id: string
  role: Role
  text: string
  gender?: Gender
}

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

  while (common < maxCommon && prevWords[common] === fullWords[common]) {
    common++
  }

  if (common === 0) return full

  const rawTokens = full.split(/\s+/)
  if (common >= rawTokens.length) return ""
  return rawTokens.slice(common).join(" ").trim()
}

// простая защита от «зацикленных» фраз
function looksLikeLoopText(text: string): boolean {
  const s = (text || "").toString().trim()
  if (!s) return true
  const words = s.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length < 24) return false

  const counts = new Map<string, number>()
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1)
  const maxWord = Math.max(...Array.from(counts.values()))
  if (maxWord / words.length > 0.28 && words.length > 40) return true

  const trigrams = new Map<string, number>()
  for (let i = 0; i + 2 < words.length; i++) {
    const tri = words[i] + " " + words[i + 1] + " " + words[i + 2]
    trigrams.set(tri, (trigrams.get(tri) || 0) + 1)
  }
  const maxTri = trigrams.size ? Math.max(...Array.from(trigrams.values())) : 0
  if (maxTri >= 6) return true

  return false
}

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isSessionActive, setIsSessionActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VideoMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const bridgedAudioStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const keepAudioElRef = useRef<HTMLAudioElement | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const audioChunksRef = useRef<Blob[]>([])
  const sentIdxRef = useRef(0)
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")
  const voiceGenderRef = useRef<Gender>("female")

  const isSessionActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const isMicMutedRef = useRef(false)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }, [])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function log(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(...args)
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

  function sttLangToLangCode(sttLang: any): string {
    const l = (sttLang || "").toString().toLowerCase()
    if (l.startsWith("ru")) return "ru-RU"
    if (l.startsWith("en")) return "en-US"
    return "uk-UA"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    return (voiceGenderRef.current || "female") === "male" ? "MALE" : "FEMALE"
  }

  function pickMime(): string | null {
    const MR: any = typeof MediaRecorder !== "undefined" ? MediaRecorder : null
    if (!MR || !MR.isTypeSupported) return null

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
    ]

    for (const c of candidates) {
      try {
        if (MR.isTypeSupported(c)) return c
      } catch {}
    }
    return null
  }

  function stopRaf() {
    if (rafRef.current) {
      try {
        cancelAnimationFrame(rafRef.current)
      } catch {}
      rafRef.current = null
    }
  }

  function stopVadAndAudio() {
    stopRaf()
    analyserRef.current = null
    const ctx = audioCtxRef.current
    if (ctx) {
      try {
        ctx.close()
      } catch {}
      audioCtxRef.current = null
    }
  }

  function stopKeepAlive() {
    const a = keepAudioElRef.current
    if (a) {
      try {
        a.pause()
      } catch {}
      try {
        ;(a as any).srcObject = null
      } catch {}
      keepAudioElRef.current = null
    }
  }

  function stopRecorder() {
    const rec: any = mediaRecorderRef.current
    if (rec && rec._reqTimer) {
      try {
        clearInterval(rec._reqTimer)
      } catch {}
      rec._reqTimer = null
    }

    if (rec) {
      try {
        if (rec.state !== "inactive") rec.stop()
      } catch {}
      mediaRecorderRef.current = null
    }
  }

  function stopStreams() {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
      streamRef.current = null
    }
    const b = bridgedAudioStreamRef.current
    if (b) {
      b.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
      bridgedAudioStreamRef.current = null
    }
  }

  function stopTtsAudio() {
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause()
      } catch {}
      ttsAudioRef.current = null
    }
  }

  const vad = useRef({
    noiseFloor: 0,
    rms: 0,
    thr: 0.008,
    voice: false,
    voiceUntilTs: 0,
    utteranceStartTs: 0,
    onCnt: 0,
    offCnt: 0,
    lastSendTs: 0,
  })

  function startVadLoop() {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.fftSize)
    const baseThr = isMobile ? 0.010 : 0.008
    const hangoverMs = isMobile ? 2080 : 1200
    const maxUtteranceMs = 8000

    const tick = () => {
      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      const now = Date.now()
      const st = vad.current

      if (!st.voice) {
        st.noiseFloor = st.noiseFloor * 0.995 + rms * 0.005
      }

      const thr = Math.max(baseThr, st.noiseFloor * 3.0)
      const voiceNow = rms > thr

      st.rms = rms
      st.thr = thr

      if (voiceNow) {
        st.onCnt = (st.onCnt || 0) + 1
        st.offCnt = 0
      } else {
        st.offCnt = (st.offCnt || 0) + 1
        st.onCnt = 0
      }

      const voiceOn = (st.onCnt || 0) >= 3
      const voiceOff = (st.offCnt || 0) >= 6

      if (voiceNow) st.voiceUntilTs = now + hangoverMs

      if (voiceOn) {
        if (!st.voice) {
          st.voice = true
          st.utteranceStartTs = now
        }
      } else if (st.voice && voiceOff && now > st.voiceUntilTs) {
        const dur = st.utteranceStartTs ? now - st.utteranceStartTs : 0
        st.voice = false
        st.utteranceStartTs = 0
        if (dur >= 350 && now - (st.lastSendTs || 0) >= 800) {
          st.lastSendTs = now
          void maybeSendStt("vad_end")
        }
      }

      if (st.voice && st.utteranceStartTs && now - st.utteranceStartTs > maxUtteranceMs) {
        st.utteranceStartTs = now
        void maybeSendStt("max_utt")
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  async function maybeSendStt(reason: string) {
    if (!isSessionActiveRef.current) return
    if (isAiSpeakingRef.current) return
    if (isMicMutedRef.current) return

    const chunks = audioChunksRef.current
    if (!chunks.length) return

    const sentIdx = sentIdxRef.current
    const take: Blob[] = []

    if (chunks.length >= 1) {
      take.push(chunks[0])
      for (let i = Math.max(1, sentIdx); i < chunks.length; i++) take.push(chunks[i])
    }

    const blob = new Blob(take, { type: take[0]?.type || "audio/webm" })
    if (blob.size < 6000) return
    if (isSttBusyRef.current) return

    try {
      isSttBusyRef.current = true
      log("[STT] send", { reason, size: blob.size, sentIdx, totalChunks: chunks.length, type: blob.type })

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-STT-Hint": "auto",
          "X-STT-Lang": computeLangCode(),
        } as any,
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
        console.error("[STT] bad response", res.status, raw)
        return
      }

      sentIdxRef.current = chunks.length

      const fullText = (data.text || "").toString().trim()
      log('[STT] transcript full="' + fullText + '"')
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) {
        log("[STT] no delta")
        return
      }

      if (looksLikeLoopText(delta)) {
        log("[STT] drop loop-like text")
        return
      }

      const userMsg: VideoMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }

      setMessages((prevMsgs) => [...prevMsgs, userMsg])
      await handleUserText(delta, sttLangToLangCode((data as any)?.lang))
    } catch (e: any) {
      console.error("[STT] fatal", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  function speakText(text: string, langCodeOverride?: string) {
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = langCodeOverride || computeLangCode()
    const gender = getCurrentGender()

    const begin = () => {
      setIsAiSpeaking(true)
      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    }

    const finish = () => {
      setIsAiSpeaking(false)
      const rec = mediaRecorderRef.current
      if (rec && rec.state === "paused" && isSessionActiveRef.current && !isMicMutedRef.current) {
        try {
          rec.resume()
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
          finish()
          return
        }

        const url = `data:audio/mp3;base64,${data.audioContent}`

        stopTtsAudio()
        const a = new Audio(url)
        ttsAudioRef.current = a
        a.onplay = begin
        a.onended = () => {
          finish()
          ttsAudioRef.current = null
        }
        a.onerror = () => {
          finish()
          ttsAudioRef.current = null
        }

        try {
          await a.play()
        } catch {
          finish()
        }
      } catch {
        finish()
      }
    })()
  }

  async function handleUserText(text: string, langCodeOverride?: string) {
    const voiceLangCode = langCodeOverride || computeLangCode()
    const lc = voiceLangCode.toLowerCase()
    const agentLang = lc.startsWith("ru") ? "ru" : lc.startsWith("en") ? "en" : "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: agentLang,
          email: effectiveEmail,
          mode: "video",
          gender: voiceGenderRef.current,
          voiceLanguage: voiceLangCode,
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

      const assistantMsg: VideoMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer, voiceLangCode)
    } catch (e: any) {
      console.error(e)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
  }

  async function startSession(gender: Gender) {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setNetworkError(
          t("Microphone/camera access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."),
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      // keepalive audio consumer
      try {
        const a = new Audio()
        a.muted = true
        ;(a as any).playsInline = true
        ;(a as any).srcObject = stream
        keepAudioElRef.current = a
        await a.play().catch(() => {})
      } catch {}

      // WebAudio bridge for stable audio + analyser (VAD)
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
      const ctx: AudioContext = new AC()
      audioCtxRef.current = ctx
      try {
        await ctx.resume()
      } catch {}

      const src = ctx.createMediaStreamSource(stream)
      const gain = ctx.createGain()
      gain.gain.value = 1.0

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      const dest = ctx.createMediaStreamDestination()

      src.connect(gain)
      gain.connect(analyser)
      gain.connect(dest)

      bridgedAudioStreamRef.current = dest.stream

      // reset state
      audioChunksRef.current = []
      sentIdxRef.current = 1
      isSttBusyRef.current = false
      lastTranscriptRef.current = ""
      vad.current = {
        noiseFloor: 0,
        rms: 0,
        thr: 0.008,
        voice: false,
        voiceUntilTs: 0,
        utteranceStartTs: 0,
        onCnt: 0,
        offCnt: 0,
        lastSendTs: 0,
      }

      const mime = pickMime()
      const opts: MediaRecorderOptions = {}
      if (mime) opts.mimeType = mime

      const rec = new MediaRecorder(dest.stream, opts)
      mediaRecorderRef.current = rec

      rec.onstart = () => {
        log("[REC] onstart", { state: rec.state, mime: (rec as any).mimeType || mime || "default" })
        setIsListening(true)
      }

      rec.ondataavailable = (ev: BlobEvent) => {
        const b = ev.data
        const size = b?.size || 0
        if (size > 0) audioChunksRef.current.push(b)
      }

      rec.onerror = (ev: any) => {
        console.error("[REC] error", ev)
      }

      rec.onstop = () => {
        setIsListening(false)
      }

      rec.start()
      setIsListening(true)

      const sliceMs = isMobile ? 1200 : 1000
      ;(rec as any)._reqTimer = window.setInterval(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.requestData()
          }
        } catch {}
      }, sliceMs)

      startVadLoop()

      isSessionActiveRef.current = true
      setIsSessionActive(true)
      setIsConnecting(false)
      setIsCameraOff(false)
      setIsMicMuted(false)
    } catch (e: any) {
      console.error("[VIDEO] start error", e)
      setIsConnecting(false)
      isSessionActiveRef.current = false
      setIsSessionActive(false)
      setIsListening(false)

      const name = e?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t("Microphone/camera is blocked for this site in the browser. Please allow access in the address bar and reload the page."),
        )
      } else {
        setNetworkError(t("Could not start session. Check permissions and try again."))
      }
    }
  }

  function endSession() {
    log("[VIDEO] endSession")

    isSessionActiveRef.current = false
    setIsSessionActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsCameraOff(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    stopVadAndAudio()
    stopRecorder()
    stopKeepAlive()
    stopStreams()
    stopTtsAudio()

    audioChunksRef.current = []
    sentIdxRef.current = 0
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false

    if (videoRef.current) {
      try {
        ;(videoRef.current as any).srcObject = null
      } catch {}
    }
  }

  function toggleMic() {
    const nextMuted = !isMicMuted
    setIsMicMuted(nextMuted)

    const stream = streamRef.current
    if (stream) {
      stream.getAudioTracks().forEach((tr) => {
        tr.enabled = !nextMuted
      })
    }

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (nextMuted) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    } else {
      if (rec.state === "paused" && isSessionActiveRef.current && !isAiSpeakingRef.current) {
        try {
          rec.resume()
        } catch {}
      }
    }
  }

  function toggleCamera() {
    const nextOff = !isCameraOff
    setIsCameraOff(nextOff)

    const stream = streamRef.current
    if (!stream) return
    stream.getVideoTracks().forEach((tr) => {
      tr.enabled = !nextOff
    })
  }

  useEffect(() => {
    if (!isOpen) {
      endSession()
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      endSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isSessionActive
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
          endSession()
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
                    <Video className="h-4 w-4" />
                  </span>
                  {t("Video session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("The assistant will listen, answer and voice the reply while you are on camera.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid h-[600px] grid-cols-1 gap-0 md:h-[640px] md:grid-cols-2">
            {/* LEFT: video */}
            <div className="flex flex-col border-b border-slate-100 md:border-b-0 md:border-r">
              <div className="relative flex-1 bg-slate-950">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${isCameraOff ? "opacity-0" : "opacity-100"}`}
                />
                {isCameraOff && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/80">
                    <div className="flex flex-col items-center gap-2">
                      <CameraOff className="h-8 w-8" />
                      <div className="text-sm">{t("Camera is off")}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Sparkles className="h-3 w-3" />
                  {statusText}
                </div>

                {isSessionActive && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleCamera}
                      className={`h-8 w-8 rounded-full border ${
                        isCameraOff
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-sky-200 bg-sky-50 text-sky-700"
                      }`}
                    >
                      {isCameraOff ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
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
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      onClick={endSession}
                      className="h-8 w-8 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <Phone className="h-4 w-4 rotate-[135deg]" />
                    </Button>
                  </div>
                )}
              </div>

              {!isSessionActive && (
                <div className="px-5 pb-5">
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
                    <p className="mb-2">
                      {t("Choose a voice and start the session. The assistant will listen and answer like a real psychologist.")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t("You can switch between female and male voice by ending the call and starting again with a different option.")}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <Button
                      type="button"
                      onClick={() => startSession("female")}
                      disabled={isConnecting}
                      className="h-11 w-full rounded-2xl bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    >
                      {isConnecting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("Connecting...")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t("Start with female voice")}
                        </span>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => startSession("male")}
                      disabled={isConnecting}
                      className="h-11 w-full rounded-2xl bg-sky-600 text-white hover:bg-sky-700"
                    >
                      {isConnecting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("Connecting...")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t("Start with male voice")}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: chat */}
            <div className="flex flex-col">
              <ScrollArea className="flex-1 px-5 pt-4 pb-2">
                <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
                  {messages.length === 0 && (
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-700">
                      <p className="mb-1 font-medium text-slate-900">{t("Say something to start")}</p>
                      <p className="text-[11px] text-slate-500">
                        {t("The assistant will transcribe your speech, respond in chat and voice the answer.")}
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
                    <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">{networkError}</div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  {t("In crisis situations, please contact local emergency services immediately.")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
