import { NextResponse } from "next/server"

export const runtime = "nodejs"

function normalizeLang(input?: string) {
  if (!input) return undefined
  const v = String(input).toLowerCase().trim()
  if (v.startsWith("ru")) return "ru"
  if (v.startsWith("uk") || v.startsWith("ua")) return "uk"
  if (v.startsWith("en")) return "en"
  return undefined
}

async function readAudioFromRequest(req: Request): Promise<{
  bytes: Uint8Array
  filename: string
  mime: string
  lang?: string
}> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  // multipart/form-data
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = (form.get("file") || form.get("audio") || form.get("blob")) as File | null
    const lang = normalizeLang(String(form.get("language") || form.get("lang") || "")) || undefined

    if (!file) throw new Error("No audio file in form-data (expected field: file)")

    const ab = await file.arrayBuffer()
    return {
      bytes: new Uint8Array(ab),
      filename: file.name || "speech.wav",
      mime: file.type || "application/octet-stream",
      lang,
    }
  }

  // JSON base64
  if (ct.includes("application/json")) {
    const j: any = await req.json()
    let b64: string = j?.audioBase64 || j?.audio || j?.data || j?.base64 || ""
    if (!b64) throw new Error("No base64 audio in JSON")

    b64 = b64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, "")
    const buf = Buffer.from(b64, "base64")
    return {
      bytes: new Uint8Array(buf),
      filename: j?.filename || "speech.wav",
      mime: j?.mime || "audio/wav",
      lang: normalizeLang(j?.language || j?.lang) || undefined,
    }
  }

  // raw body (audio/*)
  const ab = await req.arrayBuffer()
  const mime = (ct.split(";")[0] || "application/octet-stream").trim()

  return {
    bytes: new Uint8Array(ab),
    filename: "speech.wav",
    mime,
    lang: undefined,
  }
}

function toArrayBufferStrict(u8: Uint8Array): ArrayBuffer {
  // TypedArray.slice() делает копию и гарантированно даёт ArrayBuffer (не SharedArrayBuffer)
  const copy = u8.slice()
  return copy.buffer as ArrayBuffer
}

export async function POST(req: Request) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set on server" }, { status: 500 })
    }

    const { bytes, filename, mime, lang } = await readAudioFromRequest(req)

    const fd = new FormData()
    fd.append("model", "whisper-1")
    if (lang) fd.append("language", lang)

    // В Blob кладём строго ArrayBuffer (копию), чтобы TS/Next build не ругался на ArrayBufferLike/SharedArrayBuffer
    const ab = toArrayBufferStrict(bytes)
    const blob = new Blob([ab], { type: mime || "audio/wav" })
    fd.append("file", blob, filename || "speech.wav")

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: fd,
    })

    if (!r.ok) {
      const errText = await r.text().catch(() => "")
      return NextResponse.json(
        { error: "STT failed", details: errText || `HTTP ${r.status}` },
        { status: 500 },
      )
    }

    const data: any = await r.json()
    const text = String(data?.text || "").trim()
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ error: "STT error", details: e?.message || String(e) }, { status: 500 })
  }
}
