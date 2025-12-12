import OpenAI from "openai"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[STT] Missing OPENAI_API_KEY")
    return null
  }
  return new OpenAI({ apiKey })
}

function pickFilenameByContentType(ct: string): string {
  const v = (ct || "").toLowerCase()
  if (v.includes("webm")) return "speech.webm"
  if (v.includes("mp4")) return "speech.mp4"
  if (v.includes("mpeg") || v.includes("mp3")) return "speech.mp3"
  if (v.includes("wav")) return "speech.wav"
  if (v.includes("ogg")) return "speech.ogg"
  return "speech.audio"
}

function pickLanguageFromHeader(raw: string | null): "uk" | "ru" | "en" | undefined {
  const v = (raw || "").toLowerCase()
  if (v.startsWith("uk")) return "uk"
  if (v.startsWith("ru")) return "ru"
  if (v.startsWith("en")) return "en"
  return undefined
}

export async function POST(req: Request) {
  try {
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json({ success: false, error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const contentType = req.headers.get("content-type") || "application/octet-stream"
    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    // маленькие чанки считаем тишиной
    if (!arrayBuffer || byteLength < 2000) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const filename = pickFilenameByContentType(contentType)
    const file = new File([buffer], filename, { type: contentType })

    const language = pickLanguageFromHeader(req.headers.get("x-lang"))

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      ...(language ? { language } : {}),
    })

    const text = (transcription.text ?? "").trim()
    return NextResponse.json({ success: true, text }, { status: 200 })
  } catch (error) {
    console.error("[/api/stt] error:", error)
    return NextResponse.json(
      { success: false, error: "Audio file might be corrupted or unsupported" },
      { status: 500 },
    )
  }
}
