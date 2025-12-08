import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Missing OPENAI_API_KEY" },
      { status: 500 },
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file")
    const language = (formData.get("language") as string) || undefined

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 },
      )
    }

    const openaiForm = new FormData()
    openaiForm.append("file", file, "audio.webm")
    openaiForm.append("model", "whisper-1")
    openaiForm.append("response_format", "text")
    if (language) {
      // язык вроде "uk-UA" / "ru-RU" / "en-US" — Whisper всё равно понимает
      openaiForm.append("language", language)
    }

    const res = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: openaiForm,
      },
    )

    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: text || res.statusText },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, text })
  } catch (error: any) {
    console.error("[/api/stt] error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500 },
    )
  }
}
