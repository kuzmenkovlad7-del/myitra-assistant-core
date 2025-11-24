import { NextRequest, NextResponse } from "next/server"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const N8N_CHAT_WEBHOOK_URL = process.env.N8N_CHAT_WEBHOOK_URL || ""

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json()

    const userMessage: string = (requestData.query || "").trim()
    const userLanguage: string = (requestData.language || "en").toLowerCase()
    const userEmail: string = requestData.email || "user@example.com"

    if (!userMessage) {
      return NextResponse.json(
        { ok: false, error: "Empty message" },
        { status: 400 },
      )
    }

    // 1) Если настроен n8n webhook — шлём туда
    if (N8N_CHAT_WEBHOOK_URL) {
      const url = new URL(N8N_CHAT_WEBHOOK_URL)

      // Новый формат
      url.searchParams.set("text", userMessage)
      url.searchParams.set("language", userLanguage)
      url.searchParams.set("user", userEmail)

      // Старый формат, как у тебя сейчас (body[...]) — оставляю для совместимости
      url.searchParams.set("body[query]", userMessage)
      url.searchParams.set("body[language]", userLanguage)
      url.searchParams.set("body[user]", userEmail)

      console.log("Proxying request to n8n:", url.toString())

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      })

      const rawText = await response.text()
      console.log("Raw n8n response:", rawText)

      if (!response.ok) {
        console.error("n8n error:", response.status, rawText)
        return NextResponse.json(
          { ok: false, error: `n8n error: ${response.status}` },
          { status: 500 },
        )
      }

      let data: any
      try {
        data = JSON.parse(rawText)
      } catch {
        data = { response: rawText }
      }

      const text = extractPlainText(data) || getDemoText(userLanguage)
      return NextResponse.json({ ok: true, source: "n8n", text })
    }

    // 2) Если n8n нет, но есть OpenAI — спрашиваем модель напрямую
    if (OPENAI_API_KEY) {
      const systemPrompt =
        "You are an empathetic, professional AI psychologist for the MyITRA app. " +
        "Answer briefly, clearly and supportively. Avoid medical diagnoses or prescriptions. " +
        "Always respond in the language specified by the user (English, Ukrainian or Russian)."

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Language: ${userLanguage}. User email: ${userEmail}. Message: ${userMessage}`,
            },
          ],
        }),
      })

      if (!openaiResponse.ok) {
        const errText = await openaiResponse.text().catch(() => "")
        console.error("OpenAI error:", openaiResponse.status, errText)
        return NextResponse.json(
          { ok: false, error: "OpenAI error" },
          { status: 500 },
        )
      }

      const data = await openaiResponse.json()
      const text: string =
        data?.choices?.[0]?.message?.content?.trim() || getDemoText(userLanguage)

      return NextResponse.json({ ok: true, source: "openai", text })
    }

    // 3) Если нет ни n8n, ни OpenAI — аккуратный демо-ответ
    const demo = getDemoText(userLanguage)
    return NextResponse.json({ ok: true, source: "demo", text: demo })
  } catch (error) {
    console.error("Chat route error:", error)
    return NextResponse.json(
      {
        ok: false,
        error: "Chat route internal error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// --- Вспомогательные функции ---

function extractPlainText(responseData: any): string {
  if (!responseData) return ""

  if (typeof responseData === "string") return responseData.trim()

  if (Array.isArray(responseData) && responseData.length > 0) {
    const first = responseData[0]
    if (typeof first === "string") return first.trim()
    if (typeof first === "object") {
      return (
        first.text ||
        first.response ||
        first.message ||
        first.output ||
        first.content ||
        ""
      ).toString()
    }
  }

  if (typeof responseData === "object") {
    return (
      responseData.text ||
      responseData.response ||
      responseData.message ||
      responseData.output ||
      responseData.content ||
      responseData.result ||
      ""
    ).toString()
  }

  return ""
}

function getDemoText(lang: string): string {
  switch (lang) {
    case "ru":
      return "Демо-режим: чат ещё не подключён к основному серверу. Сейчас ответ формируется локально."
    case "uk":
      return "Демо-режим: чат ще не підключений до основного сервера. Зараз відповідь формується локально."
    default:
      return "Demo mode: the chat backend is not configured yet. This is a local demo reply."
  }
}
