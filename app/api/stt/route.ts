import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// роут для приёма FormData c полем "file" (Blob/WebM) и отправки в OpenAI STT
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      console.error("[STT] no file in formData")
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 },
      )
    }

    console.log("[STT] got file from client:", {
      size: (file as any).size,
      type: (file as any).type,
    })

    const transcription = await openai.audio.transcriptions.create({
      // модель можешь поменять при желании
      model: "gpt-4o-mini-transcribe",
      file: file as any,
      // можно зафиксировать язык, если нужно:
      // language: "uk",
      response_format: "json",
      temperature: 0,
    })

    const text = (transcription.text || "").toString().trim()

    console.log("[STT] success, text:", text.slice(0, 80))

    return NextResponse.json(
      {
        success: true,
        text,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[STT] route fatal error:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unexpected error while processing speech-to-text request",
      },
      { status: 500 },
    )
  }
}
