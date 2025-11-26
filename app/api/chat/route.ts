// app/api/chat/route.ts
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const {
      query,
      language = "en",
      email = null,
      channel = "chat", // "chat" или "voice"
    } = body as {
      query?: string
      language?: string
      email?: string | null
      channel?: "chat" | "voice"
    }

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { ok: false, error: "No query provided" },
        { status: 400 },
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set")
      return NextResponse.json(
        { ok: false, error: "Server config error" },
        { status: 500 },
      )
    }

    const lang = (language || "en").toLowerCase()

    const systemPrompt = `
You are a gentle, trauma-informed AI psychologist called TurbotaAI.

Your task:
- Speak in the user's language: ${lang}.
- Be calm, supportive and non-judgemental.
- Give short, clear answers (3–6 sentences), without lists and markdown.
- Do NOT give medical diagnoses or medications. 
- If user is in danger or talks about suicide, gently recommend contacting local emergency services or crisis hotline.

User e-mail (if known): ${email ?? "unknown"}.
Channel: ${channel}.
`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        temperature: 0.8,
        max_tokens: 600,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error("OpenAI error:", response.status, text)
      return NextResponse.json(
        { ok: false, error: "OpenAI request failed" },
        { status: 500 },
      )
    }

    const data = await response.json()
    const text: string =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I'm sorry, I couldn't generate a response. Please try again."

    return NextResponse.json({ ok: true, text })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
