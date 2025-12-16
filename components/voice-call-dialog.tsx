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

// основной вебхук TurbotaAI агента
const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

// запасной бекенд-прокси
const FALLBACK_CHAT_API = "/api/chat"

// аккуратно вытаскиваем текст из любого формата ответа n8n
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

// вычленяем только "новую" часть распознанного текста (чтоб не дублировало)
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
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isListeningUi, setIsListeningUi] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // --- Media / Audio ---
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioTrackRef = useRef<MediaStreamTrack | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardOnStopRef = useRef(false)

  // --- VAD state ---
  const isCallActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const isMicMutedRef = useRef(false)

  const startedAtRef = useRef(0)
  const noiseFloorRef = useRef(0.001) // будет калиброваться
  const maxRmsRef = useRef(0)
  const everHadVoiceRef = useRef(false)

  const voiceCandidateAtRef = useRef(0)
  const recordingAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)

  const baseThrRef = useRef(0.0012) // будет разный для mobile/desktop
  const baseThrMinRef = useRef(0.0006)
  const lastThrAdjustAtRef = useRef(0)

  const sttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  const debugRef = useRef(false)

  // автоскролл
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function dlog(...args: any[]) {
    if (debugRef.current) {
      // eslint-disable-next-line no-console
      console.log(...args)
    }
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

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  function getIsMobile(): boolean {
    if (typeof navigator === "undefined") return false
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  function pickRecorderMime(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined
    // порядок важен
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
      return "audio/webm;codecs=opus"
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm"
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4"
    if (MediaRecorder.isTypeSupported("audio/ogg")) return "audio/ogg"
    return undefined
  }

  function stopRafLoop() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function hardStopRecorder(discard: boolean) {
    const rec = recorderRef.current
    if (!rec) return

    discardOnStopRef.current = discard

    try {
      if (rec.state !== "inactive") {
        rec.stop()
      }
    } catch (e) {
      console.error("Recorder stop error", e)
    }
  }

  async function sendToStt(blob: Blob): Promise<string> {
    if (!blob || blob.size < 4000) return ""
    try {
      sttBusyRef.current = true
      dlog("[STT] send blob", { size: blob.size, type: blob.type })

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
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
        dlog("[STT] error", res.status, raw)
        return ""
      }

      const fullText = (data.text || "").toString().trim()
      dlog("[STT] text full =", fullText)

      if (!fullText) return ""

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      return delta || ""
    } catch (e) {
      console.error("[STT] fatal", e)
      return ""
    } finally {
      sttBusyRef.current = false
    }
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

    dlog("[CHAT] send", { resolvedWebhook, langCode, gender: voiceGenderRef.current })

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

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`)
      }

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // ok: plain string
      }

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
      console.error("Voice call error:", error)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
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
      // если юзер начал говорить поверх ассистента — мы это игнорируем (как ты и хотел)
      hardStopRecorder(true)
    }

    const finishSpeaking = () => {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)
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
          console.error("[TTS] API error", data || raw)
          finishSpeaking()
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => beginSpeaking()
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
          console.error("[TTS] play() rejected", e)
          finishSpeaking()
        }
      } catch (e) {
        console.error("[TTS] fetch error", e)
        finishSpeaking()
      }
    })()
  }

  function startVadLoop() {
    stopRafLoop()

    const analyser = analyserRef.current
    if (!analyser) return

    // параметры VAD
    const VOICE_START_MS = 140
    const SILENCE_MS = 4200              // стало длиннее — чтобы "не дослушивает" ушло
    const MAX_UTTERANCE_MS = 45000       // длинные фразы + паузы
    const TIMESLICE_MS = 250            // норм для webm/mp4

    const data = new Uint8Array(analyser.fftSize)

    const tick = () => {
      if (!isCallActiveRef.current) return

      // если мьют или ассистент говорит — ничего не пишем
      if (isMicMutedRef.current || isAiSpeakingRef.current) {
        voiceCandidateAtRef.current = 0
        // если вдруг что-то писали — выкинуть
        hardStopRecorder(true)
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      analyser.getByteTimeDomainData(data)

      let sumSq = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / data.length)

      if (rms > maxRmsRef.current) maxRmsRef.current = rms

      // калибровка noise floor, только когда не говорим и не пишем
      // (шум “плавает” и на ПК бывает меньше, чем мы ожидали)
      const noisePrev = noiseFloorRef.current
      const noiseNext = Math.max(0.0002, noisePrev * 0.985 + rms * 0.015)
      noiseFloorRef.current = noiseNext

      // адаптивный порог: базовый + от шума
      // ВАЖНО: на ПК фиксированный base 0.0045 был слишком высоким → никогда не стартовало.
      const noise = noiseFloorRef.current
      const base = baseThrRef.current
      const thr = Math.max(base, noise * 6 + 0.00035)

      // защита от “слишком низкого” thr: нужно быть заметно выше шума
      const isVoice = rms > thr && rms > noise * 2.2

      const now = performance.now()

      // если долго нет голоса — автоматически опускаем baseThr (ПК микрофоны часто тихие)
      if (!everHadVoiceRef.current && now - startedAtRef.current > 2500) {
        if (now - lastThrAdjustAtRef.current > 900) {
          // опускаем мягко, но не ниже baseThrMin
          baseThrRef.current = Math.max(baseThrMinRef.current, baseThrRef.current * 0.85)
          lastThrAdjustAtRef.current = now
        }
      }

      // запуск записи
      if (!recorderRef.current || recorderRef.current.state === "inactive") {
        // ok
      }

      const isRecording =
        recorderRef.current &&
        (recorderRef.current.state === "recording" || recorderRef.current.state === "paused")

      if (!isRecording) {
        if (isVoice) {
          if (!voiceCandidateAtRef.current) {
            voiceCandidateAtRef.current = now
          } else if (now - voiceCandidateAtRef.current >= VOICE_START_MS) {
            // старт utterance recorder
            voiceCandidateAtRef.current = 0
            everHadVoiceRef.current = true
            recordingAtRef.current = now
            lastVoiceAtRef.current = now
            discardOnStopRef.current = false

            chunksRef.current = []

            const stream = mediaStreamRef.current
            if (stream) {
              const mime = pickRecorderMime()
              const options: MediaRecorderOptions = {}
              if (mime) options.mimeType = mime

              try {
                const rec = new MediaRecorder(stream, options)
                recorderRef.current = rec

                rec.ondataavailable = (e: BlobEvent) => {
                  if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
                }

                rec.onstop = async () => {
                  const discard = discardOnStopRef.current
                  discardOnStopRef.current = false

                  const localChunks = chunksRef.current
                  chunksRef.current = []

                  // после stop() recorder становится inactive
                  recorderRef.current = null

                  if (discard) return
                  if (!localChunks.length) return

                  const mimeType = (rec.mimeType || localChunks[0]?.type || "audio/webm").toString()
                  const blob = new Blob(localChunks, { type: mimeType })

                  dlog("[REC] stopped", { size: blob.size, type: blob.type })

                  if (blob.size < 6000) return
                  if (sttBusyRef.current) return

                  const text = await sendToStt(blob)
                  if (!text) return

                  const userMsg: VoiceMessage = {
                    id: `${Date.now()}-user`,
                    role: "user",
                    text,
                  }
                  setMessages((prevMsgs) => [...prevMsgs, userMsg])
                  await handleUserText(text)
                }

                rec.onerror = (e: any) => {
                  console.error("[REC] error", e)
                }

                rec.start(TIMESLICE_MS)
                dlog("[REC] start", { mime: rec.mimeType || "auto" })
              } catch (e) {
                console.error("[REC] start failed", e)
              }
            }
          }
        } else {
          voiceCandidateAtRef.current = 0
        }
      } else {
        // идёт запись utterance
        if (isVoice) {
          lastVoiceAtRef.current = now
        }

        const recStarted = recordingAtRef.current || now
        const lastVoice = lastVoiceAtRef.current || now

        const tooLong = now - recStarted > MAX_UTTERANCE_MS
        const tooSilent = now - lastVoice > SILENCE_MS

        if (tooSilent || tooLong) {
          dlog("[REC] stop reason", { tooSilent, tooLong })
          hardStopRecorder(false)
        }
      }

      // “нет сигнала микрофона” показываем только если реально вообще ничего не поднялось
      if (now - startedAtRef.current > 6000 && maxRmsRef.current < 0.0012) {
        // один раз показать и не спамить
        if (!networkError) {
          setNetworkError(
            "На ПК не вижу сигнал микрофона. Проверь: разрешение микрофона в адресной строке, выбранный input в системе/браузере, и что микрофон не занят другим приложением. Для логов открой страницу с ?debug=1."
          )
        }
      }

      if (debugRef.current) {
        dlog("[VAD]", {
          rms: Number(rms.toFixed(5)),
          noise: Number(noise.toFixed(5)),
          thr: Number(thr.toFixed(5)),
          ctx: audioCtxRef.current?.state,
          rec: recorderRef.current?.state || "none",
          base: Number(baseThrRef.current.toFixed(5)),
          max: Number(maxRmsRef.current.toFixed(5)),
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (typeof window !== "undefined") {
        debugRef.current = new URLSearchParams(window.location.search).get("debug") === "1"
      }

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
        setIsConnecting(false)
        return
      }

      const isMobile = getIsMobile()
      baseThrRef.current = isMobile ? 0.006 : 0.0012
      baseThrMinRef.current = isMobile ? 0.004 : 0.0006

      // важное: на ПК слишком строгие noiseSuppression/AGC иногда “душат” уровень,
      // поэтому ставим их true, но пороги делаем адаптивными (см. VAD loop).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })

      mediaStreamRef.current = stream
      const track = stream.getAudioTracks()[0] || null
      audioTrackRef.current = track
      if (track) track.enabled = true

      // audio context + analyser
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as
        | typeof AudioContext
        | undefined

      if (!AudioCtx) {
        setNetworkError(
          t(
            "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."
          )
        )
        setIsConnecting(false)
        return
      }

      // закрыть старый контекст если был
      try {
        await audioCtxRef.current?.close()
      } catch {
        // ignore
      }
      audioCtxRef.current = new AudioCtx()

      try {
        await audioCtxRef.current.resume()
      } catch {
        // ignore
      }

      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.8

      sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream)
      sourceRef.current.connect(analyserRef.current)

      // reset VAD state
      isCallActiveRef.current = true
      startedAtRef.current = performance.now()
      noiseFloorRef.current = 0.001
      maxRmsRef.current = 0
      everHadVoiceRef.current = false
      voiceCandidateAtRef.current = 0
      recordingAtRef.current = 0
      lastVoiceAtRef.current = 0
      lastThrAdjustAtRef.current = 0
      lastTranscriptRef.current = ""
      sttBusyRef.current = false

      setIsCallActive(true)
      setIsListeningUi(true)
      setIsConnecting(false)

      dlog("[CALL] started", {
        isMobile,
        track: track?.label || "unknown",
        settings: track?.getSettings?.() || {},
      })

      startVadLoop()
    } catch (error: any) {
      console.error("[CALL] start error:", error)

      const name = error?.name
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
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again."
          )
        )
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
      setIsListeningUi(false)
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListeningUi(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    isAiSpeakingRef.current = false
    isMicMutedRef.current = false

    stopRafLoop()

    // recorder
    try {
      hardStopRecorder(true)
    } catch {
      // ignore
    }
    recorderRef.current = null
    chunksRef.current = []

    // audio ctx
    try {
      sourceRef.current?.disconnect()
    } catch {
      // ignore
    }
    sourceRef.current = null
    analyserRef.current = null

    try {
      audioCtxRef.current?.close()
    } catch {
      // ignore
    }
    audioCtxRef.current = null

    // tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {
          // ignore
        }
      })
    }
    mediaStreamRef.current = null
    audioTrackRef.current = null

    // tts audio
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // ignore
      }
      audioRef.current = null
    }

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {
        // ignore
      }
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next

    const track = audioTrackRef.current
    if (track) track.enabled = !next

    // если мьют — выкидываем текущую запись
    if (next) {
      hardStopRecorder(true)
    } else {
      // при анмьюте перезапускаем калибровку шума, чтобы быстрее подхватить
      noiseFloorRef.current = 0.001
      maxRmsRef.current = 0
      startedAtRef.current = performance.now()
      setNetworkError(null)
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
        : isListeningUi
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
            {/* pr-12 чтобы заголовок не лез под крестик на мобилках */}
            <div className="flex items-center justify-between gap-3 pr-12">
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
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
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
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
                        voiceGenderRef.current === "female"
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100"
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
                        voiceGenderRef.current === "male"
                          ? "bg-sky-600 text-white hover:bg-sky-700"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
