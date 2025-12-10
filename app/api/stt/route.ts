import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Минимальный размер полезного аудио (в байтах), меньше — считаем шумом/тишиной
const MIN_AUDIO_BYTES = 800

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!OPENAI_API_KEY) {
      console.error("[STT] OPENAI_API_KEY is not set")
      return NextResponse.json(
        {
          success: false,
          error: "Speech-to-text service is temporarily unavailable.",
        },
        { status: 500 },
      )
    }

    const contentType = req.headers.get("content-type") || ""
    let audioBlob: Blob | null = null
    let language = "uk" // дефолт — укр

    if (contentType.includes("multipart/form-data")) {
      // Вариант, когда фронт шлёт FormData с полем file
      const formData = await req.formData()
      const file = formData.get("file")
      const langField = formData.get("language")

      if (file instanceof Blob) {
        audioBlob = file
      }

      if (typeof langField === "string" && langField.trim().length > 0) {
        language = langField.trim()
      }
    } else {
      // Вариант, когда шлём сырой бинарный поток
      const arrayBuffer = await req.arrayBuffer()

      if (arrayBuffer.byteLength === 0) {
        console.log("[STT] empty audio chunk, returning empty text")
        return NextResponse.json(
          {
            success: true,
            text: "",
          },
          { status: 200 },
        )
      }

      audioBlob = new Blob([arrayBuffer], { type: "audio/webm" })
    }

    if (!audioBlob) {
      console.log("[STT] no audio file in request")
      return NextResponse.json(
        {
          success: true,
          text: "",
        },
        { status: 200 },
      )
    }

    if (audioBlob.size < MIN_AUDIO_BYTES) {
      console.log("[STT] audio chunk is too small, size =", audioBlob.size)
      return NextResponse.json(
        {
          success: true,
          text: "",
        },
        { status: 200 },
      )
    }

    // Готовим запрос в OpenAI Whisper
    const openaiForm = new FormData()
    openaiForm.append("file", audioBlob, "audio.webm")
    openaiForm.append("model", "whisper-1")
    openaiForm.append("response_format", "json")
    openaiForm.append("language", language)

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: openaiForm,
      },
    )

    const raw = await openaiRes.text()
    let data: any = null

    try {
      data = raw ? JSON.parse(raw) : null
    } catch (err) {
      console.error(
        "[STT] cannot parse OpenAI response JSON, raw:",
        raw.slice(0, 500),
      )
      data = null
    }

    if (!openaiRes.ok || !data) {
      console.error(
        "[STT] OpenAI error:",
        openaiRes.status,
        openaiRes.statusText,
        raw.slice(0, 500),
      )

      const msg =
        (data &&
          data.error &&
          typeof data.error.message === "string" &&
          data.error.message) ||
        `OpenAI STT error: ${openaiRes.status} ${openaiRes.statusText}`

      return NextResponse.json(
        {
          success: false,
          error: msg,
        },
        { status: 500 },
      )
    }

    const text = (data.text ?? "").toString().trim()

    if (!text) {
      console.log("[STT] success but empty text")
    } else {
      console.log("[STT] success, text:", text.slice(0, 80))
    }

    return NextResponse.json(
      {
        success: true,
        text,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[STT] route fatal error:", error)

    const msg =
      (error && typeof error.message === "string" && error.message) ||
      "Unexpected error while processing speech-to-text request"

    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 },
    )
  }
}
