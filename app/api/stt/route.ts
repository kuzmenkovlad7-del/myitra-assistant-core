import { NextResponse } from "next/server"

export const runtime = "edge"

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || ""

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid content type. Expected multipart/form-data.",
        },
        { status: 400 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")
    const language = (formData.get("language") as string | null) || undefined

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No audio file provided.",
        },
        { status: 400 },
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("[STT] Missing OPENAI_API_KEY")
      return NextResponse.json(
        {
          success: false,
          error: "STT is temporarily unavailable.",
        },
        { status: 500 },
      )
    }

    // СЛИШКОМ КОРОТКИЕ КУСКИ (тишина) — НЕ ГОНИМ В OpenAI, просто пустой текст
    if (file.size < 2000) {
      return NextResponse.json(
        {
          success: true,
          text: "",
        },
        { status: 200 },
      )
    }

    const openaiForm = new FormData()
    openaiForm.set("file", file)
    // модель можно при желании сменить на whisper-1
    openaiForm.set("model", "gpt-4o-mini-transcribe")

    if (language) {
      // "uk-UA" -> "uk", "ru-RU" -> "ru"
      openaiForm.set("language", language.split("-")[0])
    }

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: openaiForm,
      },
    )

    const raw = await openaiRes.text()
    let data: any

    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!openaiRes.ok || !data) {
      console.error(
        "[STT] OpenAI error:",
        openaiRes.status,
        openaiRes.statusText,
        raw.slice(0, 500),
      )

      return NextResponse.json(
        {
          success: false,
          error:
            (data as any)?.error?.message ||
            `OpenAI STT error: ${openaiRes.status} ${openaiRes.statusText}`,
        },
        { status: 500 },
      )
    }

    const text =
      (data as any)?.text?.toString().trim?.() ??
      ""

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
          (error as any)?.message ||
          "Unexpected error while processing speech-to-text request",
      },
      { status: 500 },
    )
  }
}
