import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// важно: обычный node-runtime, не edge
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "audio/webm"

    // читаем сырые байты аудио
    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    // если фрагмент совсем крошечный — считаем, что это тишина, просто ничего не распознаём
    if (!arrayBuffer || byteLength < 2000) {
      return NextResponse.json(
        {
          success: true,
          text: "",
        },
        { status: 200 },
      )
    }

    const buffer = Buffer.from(arrayBuffer)

    // File доступен в node 18+ / next 13+ как глобальный класс
    const file = new File([buffer], "speech.webm", { type: contentType })

    // язык можем пробрасывать заголовком x-lang, но он не обязателен
    const rawLang = (req.headers.get("x-lang") || "").toLowerCase()
    let language: string | undefined

    if (rawLang.startsWith("uk")) language = "uk"
    else if (rawLang.startsWith("ru")) language = "ru"
    else if (rawLang.startsWith("en")) language = "en"
    // если ничего не передано — Whisper сам детектит язык

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      ...(language ? { language } : {}),
    })

    const text = (transcription.text ?? "").trim()

    return NextResponse.json(
      {
        success: true,
        text,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[/api/stt] error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Audio file might be corrupted or unsupported",
      },
      { status: 500 },
    )
  }
}
