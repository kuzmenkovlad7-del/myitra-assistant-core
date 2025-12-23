import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Lang3 = "uk" | "ru" | "en"
type Hint3 = Lang3 | "auto"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "whisper-1"

type WhisperVerboseJson = {
  text?: string
  language?: string
  segments?: Array<{
    avg_logprob?: number
    no_speech_prob?: number
    compression_ratio?: number
    temperature?: number
    text?: string
  }>
}

type ScoreMeta = {
  avgLogprob?: number
  noSpeechProb?: number
  compressionRatio?: number
  temperature?: number
}

function avg(nums: Array<number | undefined>): number | undefined {
  const xs = nums.filter((n): n is number => typeof n === "number")
  if (!xs.length) return undefined
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function scoreFromVerboseJson(json: WhisperVerboseJson): ScoreMeta {
  const segs = Array.isArray(json.segments) ? json.segments : []
  return {
    avgLogprob: avg(segs.map((s) => s.avg_logprob)),
    noSpeechProb: avg(segs.map((s) => s.no_speech_prob)),
    compressionRatio: avg(segs.map((s) => s.compression_ratio)),
    temperature: avg(segs.map((s) => s.temperature)),
  }
}

function lang3FromWhisper(language?: string): Lang3 {
  const l = (language || "").toLowerCase()
  if (l.startsWith("uk")) return "uk"
  if (l.startsWith("ru")) return "ru"
  return "en"
}

function normalizeHint(h?: string | null): Hint3 {
  const s = String(h || "").trim().toLowerCase()
  if (!s) return "uk" // default MVP
  if (s === "auto") return "auto"
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  if (s.startsWith("en")) return "en"
  return "uk"
}

function normalizeText(s: string): string {
  return String(s || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const HALLUCINATION_PHRASES = [
  // RU
  "спасибо за просмотр",
  "спасибо за внимание",
  "ставьте лайк",
  "подписывайтесь на канал",
  "подписывайтесь",
  "до новых встреч",
  // UK
  "дякую за перегляд",
  "дякую за увагу",
  "підписуйтеся на канал",
  "підписуйтеся",
  "ставте вподобайку",
  "до зустрічі",
  // EN
  "thanks for watching",
  "thanks for listening",
  "like and subscribe",
  "subscribe to the channel",
  "see you next time",
]

function isLikelyHallucination(text: string): boolean {
  const norm = normalizeText(text).toLowerCase()
  if (!norm) return true
  if (/^(\[?music\]?|\[?applause\]?|\(?music\)?|\(?applause\)?)$/.test(norm)) return true
  if (norm.length <= 2) return true

  for (const p of HALLUCINATION_PHRASES) {
    if (norm === p) return true
    if (norm.startsWith(p + " ")) return true
    if (norm.endsWith(" " + p)) return true
  }
  return false
}

function shouldDropTranscript(text: string, meta: ScoreMeta): boolean {
  const cleaned = normalizeText(text)
  if (!cleaned) return true

  const norm = cleaned.toLowerCase()
  const noSpeech = meta.noSpeechProb ?? 0
  const logp = meta.avgLogprob ?? 0

  // If Whisper itself thinks it's "no speech", drop short-ish outputs.
  if (noSpeech >= 0.7 && norm.length <= 80) return true

  // Very low confidence + short output is usually garbage on silence/noise.
  if (logp <= -1.2 && norm.length <= 80) return true

  // Common hallucinated "outro" phrases.
  if (isLikelyHallucination(norm) && (noSpeech >= 0.35 || norm.length <= 40)) return true

  return false
}

async function callWhisper(audio: File, lang?: Lang3): Promise<{ text: string; whisperLang?: string; meta: ScoreMeta }> {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const fd = new FormData()
  fd.append("model", OPENAI_STT_MODEL)
  fd.append("file", audio, audio.name || "audio.webm")
  fd.append("response_format", "verbose_json")
  if (lang) fd.append("language", lang)

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: fd,
  })

  if (!r.ok) {
    const errText = await r.text().catch(() => "")
    throw new Error(`OpenAI STT failed: ${r.status} ${r.statusText} ${errText}`.slice(0, 800))
  }

  const raw = await r.text()
  let json: WhisperVerboseJson = {}
  try {
    json = JSON.parse(raw)
  } catch {
    // ignore, fall back to raw text
  }

  const text = normalizeText(json.text || raw || "")
  const whisperLang = (json.language || "").toLowerCase() || undefined
  const meta = scoreFromVerboseJson(json)

  return { text, whisperLang, meta }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const audio = formData.get("audio")
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, error: "No audio file provided" }, { status: 400 })
    }

    // We respect the UI language hint (MVP). VoiceCallDialog already sends X-STT-Hint.
    const hintHeader = req.headers.get("x-stt-hint") || req.headers.get("x-stt-lang")
    const hint3 = normalizeHint(hintHeader)

    const res = await callWhisper(audio, hint3 === "auto" ? undefined : hint3)
    const pickedLang: Lang3 = hint3 === "auto" ? lang3FromWhisper(res.whisperLang) : hint3

    if (shouldDropTranscript(res.text, res.meta)) {
      return NextResponse.json({
        success: true,
        text: "",
        lang: pickedLang,
        debug: {
          pickedBy: hint3 === "auto" ? "auto" : "hint",
          hint3,
          whisperLang: res.whisperLang,
          meta: res.meta,
          dropped: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      text: res.text,
      lang: pickedLang,
      debug: {
        pickedBy: hint3 === "auto" ? "auto" : "hint",
        hint3,
        whisperLang: res.whisperLang,
        meta: res.meta,
        dropped: false,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e?.message || "STT error",
      },
      { status: 500 },
    )
  }
}
