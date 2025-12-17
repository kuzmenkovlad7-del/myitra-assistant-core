export const runtime = "nodejs"

function pickFilename(ct: string) {
  const s = (ct || "").toLowerCase()
  if (s.includes("webm")) return "speech.webm"
  if (s.includes("mp4")) return "speech.mp4"
  if (s.includes("mpeg") || s.includes("mp3")) return "speech.mp3"
  if (s.includes("wav")) return "speech.wav"
  if (s.includes("ogg")) return "speech.ogg"
  if (s.includes("m4a")) return "speech.m4a"
  return "speech.audio"
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json(
        { success: false, error: "OPENAI_API_KEY is not set" },
        { status: 500 },
      )
    }

    const ct = req.headers.get("content-type") || "application/octet-stream"
    const ab = await req.arrayBuffer()
    const bytes = new Uint8Array(ab)

    if (!bytes || bytes.byteLength === 0) {
      return Response.json(
        { success: false, error: "Empty audio body" },
        { status: 400 },
      )
    }

    const filename = pickFilename(ct)
    const file = new File([bytes], filename, { type: ct })

    const form = new FormData()
    form.append("file", file)
    form.append("model", "whisper-1")

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    })

    const textRaw = await r.text()
    let data: any = null
    try {
      data = textRaw ? JSON.parse(textRaw) : null
    } catch {
      data = null
    }

    if (!r.ok) {
      return Response.json(
        { success: false, error: data?.error?.message || textRaw || "STT error" },
        { status: 500 },
      )
    }

    const text = (data?.text || "").toString().trim()
    return Response.json({ success: true, text })
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Unknown STT error" },
      { status: 500 },
    )
  }
}
