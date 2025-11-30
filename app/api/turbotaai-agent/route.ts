// app/api/turbotaai-agent/route.ts
import { NextRequest, NextResponse } from "next/server"

const N8N_WEBHOOK_URL =
  process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL ??
  "https://n8n.vladkuzmenko.com/webhook/turbotaai-agent"

// Универсальный прокси в n8n (всегда POST)
async function forwardToN8N(payload: any) {
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  })

  const text = await res.text()
  const contentType = res.headers.get("content-type") || "text/plain"

  // если это JSON — вернём JSON
  if (contentType.includes("application/json")) {
    try {
      const json = text ? JSON.parse(text) : {}
      return NextResponse.json(json, { status: res.status })
    } catch {
      // если вдруг не распарсилось — отдадим как текст
    }
  }

  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": contentType },
  })
}

// POST: основной путь для чата / голоса / видео
export async function POST(req: NextRequest) {
  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    // пустое тело — не критично
  }

  return forwardToN8N(payload)
}

// GET: на случай старого кода вида /api/turbotaai-agent?query=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const query =
    url.searchParams.get("query") ||
    url.searchParams.get("q") ||
    url.searchParams.get("text") ||
    url.searchParams.get("message")

  // если текста нет — это просто health-check, отвечаем ок
  if (!query) {
    return NextResponse.json({ ok: true })
  }

  const language = url.searchParams.get("language") || "uk"
  const email =
    url.searchParams.get("email") ||
    url.searchParams.get("userEmail") ||
    "guest@example.com"
  const mode = url.searchParams.get("mode") || "video"

  const payload = {
    query,
    language,
    email,
    mode,
  }

  return forwardToN8N(payload)
}

// чтобы Next не кешировал
export const dynamic = "force-dynamic"
