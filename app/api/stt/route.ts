import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Lang3 = "uk" | "ru" | "en"

function normalizeHint(h: string | null): Lang3 {
  const s = (h || "").toLowerCase()
  if (s.includes("ru")) return "ru"
  if (s.includes("en")) return "en"
  return "uk"
}

function orderFromHint(h: Lang3): Lang3[] {
  if (h === "ru") return ["ru", "uk", "en"]
  if (h === "en") return ["en", "uk", "ru"]
  return ["uk", "ru", "en"]
}

function clampText(t: any): string {
  return (t ?? "").toString().replace(/\s+/g, " ").trim()
}

function hasUkLetters(s: string): boolean {
  return /[іІїЇєЄґҐ]/.test(s)
}
function hasRuLetters(s: string): boolean {
  return /[ыЫэЭёЁъЪ]/.test(s)
}

function isHallucination(text: string): boolean {
  const t = (text || "").toLowerCase()
  if (!t) return true
  if (t.includes("thank you for watching")) return true
  if (t.includes("thanks for watching")) return true
  if (t.includes("like and subscribe")) return true
  if (t.includes("підпис")) return true
  if (t.includes("подпис")) return true
  return false
}

function avg(nums: number[]): number {
  if (!nums.length) return -999
  let s = 0
  for (const n of nums) s += n
  return s / nums.length
}

function scoreFromVerboseJson(j: any): { avgLog: number; noSpeech: number; score: number } {
  const segs: any[] = Array.isArray(j?.segments) ? j.segments : []
  const logps: number[] = []
  const nos: number[] = []

  for (const s of segs) {
    if (typeof s?.avg_logprob === "number") logps.push(s.avg_logprob)
    if (typeof s?.no_speech_prob === "number") nos.push(s.no_speech_prob)
  }

  const avgLog = avg(logps)
  const noSpeech = avg(nos)
  const score = avgLog - (Number.isFinite(noSpeech) ? noSpeech * 1.2 : 0)
  return { avgLog, noSpeech, score }
}

function lang3FromWhisper(lang: any): Lang3 | null {
  const s = (lang || "").toString().toLowerCase()
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  if (s.startsWith("en")) return "en"
  return null
}

function extFromContentType(ct: string): string {
  const x = (ct || "").split(";")[0].trim().toLowerCase()
  if (x.includes("webm")) return "webm"
  if (x.includes("ogg")) return "ogg"
  if (x.includes("wav")) return "wav"
  if (x.includes("mpeg") || x.includes("mp3")) return "mp3"
  if (x.includes("mp4")) return "mp4"
  return "webm"
}

async function callWhisper(audio: Blob, lang?: Lang3): Promise<{ text: string; whisperLang: string | null; meta: any }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing")

  const model = process.env.OPENAI_STT_MODEL || "whisper-1"
  const ct = audio.type || "audio/webm"
  const ext = extFromContentType(ct)
  const file = new File([audio], `audio.${ext}`, { type: ct })

  const fd = new FormData()
  fd.append("file", file)
  fd.append("model", model)
  fd.append("response_format", "verbose_json")
  fd.append("temperature", "0")
  if (lang) fd.append("language", lang)

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  })

  const raw = await r.text()
  if (!r.ok) throw new Error(`OpenAI STT failed (${r.status}): ${raw.slice(0, 400)}`)

  const j = raw ? JSON.parse(raw) : {}
  const text = clampText(j?.text)
  const whisperLang = typeof j?.language === "string" ? j.language : null
  const meta = scoreFromVerboseJson(j)
  return { text, whisperLang, meta }
}

function adjustScoreForLetters(lang: Lang3, text: string, baseScore: number): number {
  let score = baseScore
  const uk = hasUkLetters(text)
  const ru = hasRuLetters(text)

  if (lang === "uk") {
    if (uk) score += 0.8
    if (ru) score -= 0.8
  } else if (lang === "ru") {
    if (ru) score += 0.8
    if (uk) score -= 0.8
  }
  return score
}

function pickRuUkByScores(hint: Lang3, ru: { score: number; noSpeech: number }, uk: { score: number; noSpeech: number }): "ru" | "uk" {
  if (ru.noSpeech > 0.75 && uk.noSpeech < 0.55) return "uk"
  if (uk.noSpeech > 0.75 && ru.noSpeech < 0.55) return "ru"

  const diff = uk.score - ru.score
  const abs = Math.abs(diff)

  // ключевой фикс: если уверенность почти одинаковая — НЕ прыгаем, держим hint
  if (abs < 0.35) return hint === "ru" ? "ru" : "uk"

  return diff > 0 ? "uk" : "ru"
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "audio/webm"
    const hintHeader = req.headers.get("x-stt-hint") || req.headers.get("x-stt-lang") || ""
    const hint = normalizeHint(hintHeader)

    const ab = await req.arrayBuffer()
    const audio = new Blob([ab], { type: ct })

    if (audio.size < 6000) {
      return NextResponse.json({ success: true, text: "", lang: hint, dropped: "tiny" })
    }

    // 1) AUTO (без language) — чтобы ловить акустику ru vs uk
    const auto = await callWhisper(audio)
    const autoText = auto.text
    const autoLang3 = lang3FromWhisper(auto.whisperLang)

    // фильтры тишины/галлюцинаций
    if (autoText && isHallucination(autoText) && auto.meta.noSpeech > 0.25) {
      return NextResponse.json({ success: true, text: "", lang: hint, dropped: "hallucination", debug: { auto } })
    }
    if (!autoText && auto.meta.noSpeech > 0.6) {
      return NextResponse.json({ success: true, text: "", lang: hint, dropped: "no_speech", debug: { auto } })
    }

    // en — можно сразу вернуть
    if (autoLang3 === "en") {
      return NextResponse.json({ success: true, text: autoText, lang: "en", debug: { pickedBy: "auto_en", auto } })
    }

    // 2) ru/uk — уточняем ДВУМЯ прогонами и берём лучший с тэйбрейком
    if (autoLang3 === "ru" || autoLang3 === "uk") {
      const ruR = await callWhisper(audio, "ru")
      const ukR = await callWhisper(audio, "uk")

      const ruScore = adjustScoreForLetters("ru", ruR.text, ruR.meta.score)
      const ukScore = adjustScoreForLetters("uk", ukR.text, ukR.meta.score)

      const picked = pickRuUkByScores(hint, { score: ruScore, noSpeech: ruR.meta.noSpeech }, { score: ukScore, noSpeech: ukR.meta.noSpeech })
      const outText = picked === "ru" ? ruR.text : ukR.text

      return NextResponse.json({
        success: true,
        text: outText,
        lang: picked,
        debug: {
          pickedBy: "auto+ruuk",
          auto,
          ru: { meta: ruR.meta, adj: ruScore, sample: ruR.text.slice(0, 120) },
          uk: { meta: ukR.meta, adj: ukScore, sample: ukR.text.slice(0, 120) },
          hint,
        },
      })
    }

    // 3) авто определил что-то другое (например pl) — форсим только ru/uk/en и выбираем по score
    const order = orderFromHint(hint)
    const tries: Array<{ lang: Lang3; text: string; score: number; noSpeech: number; meta: any }> = []

    for (const l of order) {
      const r = await callWhisper(audio, l)
      const s = adjustScoreForLetters(l, r.text, r.meta.score)
      tries.push({ lang: l, text: r.text, score: s, noSpeech: r.meta.noSpeech, meta: r.meta })
    }

    tries.sort((a, b) => b.score - a.score)
    const best = tries[0]

    if (!best.text) {
      return NextResponse.json({ success: true, text: "", lang: hint, dropped: "empty", debug: { auto, tries } })
    }

    return NextResponse.json({ success: true, text: best.text, lang: best.lang, debug: { pickedBy: "forced3", auto, tries } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: (e?.message || "STT error").toString() }, { status: 500 })
  }
}
