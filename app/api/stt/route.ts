import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function pickExt(contentType: string) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("mp4") || ct.includes("m4a")) return "mp4"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("webm")) return "webm"
  return "webm"
}

export async function POST(req: NextRequest) {
  try {
    const contentType =
      req.headers.get("content-type") || "application/octet-stream"

    const arrayBuffer = await req.arrayBuffer()
    const size = arrayBuffer?.byteLength ?? 0

    // очень маленькие куски — это тишина/шум
    if (!arrayBuffer || size < 1200) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const ext = pickExt(contentType)
    const file = new File([buffer], `speech.${ext}`, { type: contentType })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
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
