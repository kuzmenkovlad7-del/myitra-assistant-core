import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import {
  OPENAI_TTS_MODEL,
  normalizeLanguage,
  normalizeGender,
  selectOpenAIVoice,
} from "@/lib/google-tts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))

    const rawText = (body as any).text ?? (body as any).input ?? (body as any).query ?? ""
    const text = String(rawText || "").trim()

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Missing 'text' for TTS" },
        { status: 400 },
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing OPENAI_API_KEY" },
        { status: 500 },
      )
    }

    const lang = normalizeLanguage((body as any).language)
    const gender = normalizeGender((body as any).gender)

    // ВАЖНО: голоса берём из selectOpenAIVoice (мы ниже вернём дефолты как раньше)
    const voice = selectOpenAIVoice(lang, gender)

    const response = await openai.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: voice as any,
      input: text,
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    const audioContent = buffer.toString("base64")

    return NextResponse.json({
      success: true,
      audioContent,
      language: lang,
      gender,
      voice,
      contentType: "audio/mpeg",
    })
  } catch (error: any) {
    console.error("[/api/tts] Error:", error)
    return NextResponse.json(
      { success: false, error: "TTS generation failed" },
      { status: 500 },
    )
  }
}
