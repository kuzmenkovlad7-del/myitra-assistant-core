import OpenAI from "openai"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TtsBody = {
  text?: unknown
  query?: unknown
  language?: unknown
  gender?: unknown
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

function pickModel(): string {
  return process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"
}

function pickVoice(genderRaw: unknown): string {
  const g = String(genderRaw || "").toLowerCase()
  if (g === "male" || g === "m" || g === "man") {
    return process.env.OPENAI_TTS_VOICE_MALE || "verse"
  }
  return process.env.OPENAI_TTS_VOICE_FEMALE || "alloy"
}

export async function POST(req: Request) {
  try {
    const body: TtsBody = await req.json().catch(() => ({} as any))

    const text = String(body.text ?? body.query ?? "").trim()
    if (!text) {
      return NextResponse.json({ success: false, error: "Missing text" }, { status: 400 })
    }

    const openai = getOpenAIClient()
    if (!openai) {
      // важно: не throw, чтобы next build не падал при импорте роутов
      return NextResponse.json({ success: false, error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const model = pickModel()
    const voice = pickVoice(body.gender)

    // У разных версий OpenAI SDK поле называется по-разному.
    // Чтобы не ломать билд типами — передаём как any и используем response_format.
    const params: any = {
      model,
      voice,
      input: text,
      response_format: "mp3",
    }

    const speech: any = await (openai as any).audio.speech.create(params)

    const arrayBuffer = await speech.arrayBuffer()
    const audioContent = Buffer.from(arrayBuffer).toString("base64")

    return NextResponse.json({ success: true, audioContent }, { status: 200 })
  } catch (error) {
    console.error("[/api/tts] error:", error)
    return NextResponse.json({ success: false, error: "TTS failed" }, { status: 500 })
  }
}
