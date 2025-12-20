import OpenAI from "openai"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type Lang = "ru" | "uk" | "en"

const STT_MODEL = process.env.OPENAI_STT_MODEL || "whisper-1"

function cleanText(s: string): string {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
}

function hasCyrillic(s: string): boolean {
  return /[А-Яа-яЁёІіЇїЄєҐґ]/.test(s)
}

function hasLatin(s: string): boolean {
  return /[A-Za-z]/.test(s)
}

function looksEnglish(s: string): boolean {
  const t = cleanText(s).toLowerCase()
  if (!t) return false
  // очень простая эвристика: латиница + несколько частых EN слов
  const enHits =
    (/\b(the|and|you|your|are|i|we|to|of|in|on|for|with|how|what|why|today)\b/.test(t) ? 1 : 0) +
    (/\b(thank|thanks|watching|subscribe|support|help|ready)\b/.test(t) ? 1 : 0)
  return hasLatin(t) && enHits > 0
}

function normalizeHint(h: string | null): Lang | "" {
  const v = (h || "").toLowerCase().trim()
  if (v === "ru" || v === "uk" || v === "en") return v
  return ""
}

function isMostlyNoise(s: string): boolean {
  const t = cleanText(s)
  if (!t) return true

  // если нет букв — это мусор
  if (!/[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]/.test(t)) return true

  // слишком повторяющиеся символы (hallucination на тишине)
  const noSpace = t.replace(/\s+/g, "")
  if (noSpace.length >= 10) {
    let same = 0
    for (let i = 1; i < noSpace.length; i++) {
      if (noSpace[i] === noSpace[0]) same++
    }
    if (same / (noSpace.length - 1) > 0.85) return true
  }

  return false
}

const JUNK_PHRASES = [
  "thank you for watching",
  "thanks for watching",
  "thank you for watching.",
  "thanks for watching.",
  "спасибо за просмотр",
  "субтитры",
  "подписывайтесь на канал",
  "like and subscribe",
]

function isJunkPhrase(s: string): boolean {
  const t = cleanText(s).toLowerCase()
  if (!t) return true
  for (const p of JUNK_PHRASES) {
    if (t === p || t.startsWith(p + " ") || t.includes(" " + p + " ")) return true
  }
  return false
}

function mapLang(raw: string): Lang | "" {
  const v = (raw || "").toLowerCase()
  if (v.startsWith("ru")) return "ru"
  if (v.startsWith("uk")) return "uk"
  if (v.startsWith("en")) return "en"
  return ""
}

function ukLetterScore(s: string): number {
  // украинские уникальные: і ї є ґ
  const t = s || ""
  let score = 0
  for (const ch of t) {
    if (ch === "і" || ch === "І") score += 2
    else if (ch === "ї" || ch === "Ї") score += 3
    else if (ch === "є" || ch === "Є") score += 2
    else if (ch === "ґ" || ch === "Ґ") score += 3
  }
  return score
}

function ruLetterScore(s: string): number {
  // русские маркеры: ё ъ ы э
  const t = s || ""
  let score = 0
  for (const ch of t) {
    if (ch === "ё" || ch === "Ё") score += 3
    else if (ch === "ъ" || ch === "Ъ") score += 2
    else if (ch === "ы" || ch === "Ы") score += 2
    else if (ch === "э" || ch === "Э") score += 2
  }
  return score
}

function tokenJaccard(a: string, b: string): number {
  const A = cleanText(a).toLowerCase().split(" ").filter(Boolean)
  const B = cleanText(b).toLowerCase().split(" ").filter(Boolean)
  if (A.length === 0 || B.length === 0) return 0

  const amap: Record<string, 1> = {}
  const bmap: Record<string, 1> = {}

  for (const t of A) amap[t] = 1
  for (const t of B) bmap[t] = 1

  let inter = 0
  let uni = 0

  // union
  for (const k in amap) uni++
  for (const k in bmap) {
    if (!amap[k]) uni++
  }

  // intersection
  for (const k in amap) {
    if (bmap[k]) inter++
  }

  return uni ? inter / uni : 0
}

async function transcribeOnce(file: File, language?: Lang): Promise<{ text: string; languageRaw: string }> {
  const res = await openai.audio.transcriptions.create({
    file,
    model: STT_MODEL,
    response_format: "verbose_json",
    temperature: 0,
    ...(language ? { language } : {}),
  } as any)

  const text = cleanText((res as any).text || "")
  const languageRaw = String((res as any).language || "")
  return { text, languageRaw }
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData()
    const audio = fd.get("audio")

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Missing audio file (field: audio)" }, { status: 400 })
    }

    const hint = normalizeHint(req.headers.get("x-stt-hint"))

    // 1) БАЗОВАЯ транскрипция (без принудительного языка)
    const base = await transcribeOnce(audio)
    const baseText = base.text
    const baseLang = mapLang(base.languageRaw)

    // фильтры тишины/галлюцинаций
    if (!baseText || isMostlyNoise(baseText) || isJunkPhrase(baseText)) {
      console.log("[/api/stt] drop (junk/noise)", { baseText, baseLang, hint })
      return NextResponse.json({ text: "", language: hint || "uk", dropped: true })
    }

    // 2) Если Whisper сам дал ru/uk/en — НИЧЕГО НЕ ПЕРЕВОДИМ, возвращаем как есть
    if (baseLang) {
      console.log("[/api/stt] base-ok", { baseLang, hint, textSample: baseText.slice(0, 80) })
      return NextResponse.json({ text: baseText, language: baseLang })
    }

    // 3) Если латиница и похоже на EN — отдаем EN как есть
    if (hasLatin(baseText) && looksEnglish(baseText)) {
      console.log("[/api/stt] base-en-heuristic", { hint, textSample: baseText.slice(0, 80) })
      return NextResponse.json({ text: baseText, language: "en" })
    }

    // 4) ИНАЧЕ: ограничиваемся только ru/uk (никаких pl/de/etc в UI)
    //    Делаем 2 прогона и выбираем по близости к base + буквенным маркерам.
    const ru = await transcribeOnce(audio, "ru")
    const uk = await transcribeOnce(audio, "uk")

    const simRu = hasCyrillic(baseText) ? tokenJaccard(baseText, ru.text) : 0
    const simUk = hasCyrillic(baseText) ? tokenJaccard(baseText, uk.text) : 0

    let picked: Lang = "ru"
    if (simUk > simRu + 0.05) picked = "uk"
    else if (simRu > simUk + 0.05) picked = "ru"
    else {
      // tie-break по буквенным маркерам
      const ruScore = ruLetterScore(ru.text) - ukLetterScore(ru.text)
      const ukScore = ukLetterScore(uk.text) - ruLetterScore(uk.text)

      if (ukScore > ruScore) picked = "uk"
      else if (ruScore > ukScore) picked = "ru"
      else if (hint) picked = hint
      else picked = "ru"
    }

    const finalText = picked === "uk" ? uk.text : ru.text

    if (!finalText || isMostlyNoise(finalText) || isJunkPhrase(finalText)) {
      console.log("[/api/stt] drop-after-pick", { picked, hint, finalText })
      return NextResponse.json({ text: "", language: hint || picked, dropped: true })
    }

    console.log("[/api/stt] picked-ruuk", {
      hint,
      picked,
      baseSample: baseText.slice(0, 80),
      simRu,
      simUk,
      ruSample: ru.text.slice(0, 80),
      ukSample: uk.text.slice(0, 80),
    })

    return NextResponse.json({ text: finalText, language: picked })
  } catch (e: any) {
    console.error("[/api/stt] error", e)
    return NextResponse.json({ error: e?.message || "STT failed" }, { status: 500 })
  }
}
