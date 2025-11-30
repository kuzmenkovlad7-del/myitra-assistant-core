import { NextRequest, NextResponse } from "next/server"

const N8N_WEBHOOK_URL =
  process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL ||
  "https://n8n.vladkuzmenko.com/webhook/turbotaai-agent"

// GET /api/turbotaai-agent?text=... → проксируем в n8n как POST JSON
export async function GET(req: NextRequest) {
  const clientUrl = new URL(req.url)
  const n8nUrl = new URL(N8N_WEBHOOK_URL)

  const payload: Record<string, string> = {}

  // дублируем параметры и в query, и в body
  clientUrl.searchParams.forEach((value, key) => {
    n8nUrl.searchParams.set(key, value)
    payload[key] = value
  })

  const res = await fetch(n8nUrl.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const text = await res.text()

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "text/plain",
    },
  })
}

// POST /api/turbotaai-agent → прозрачный прокси в n8n (для голоса/чата)
export async function POST(req: NextRequest) {
  const body = await req.text()
  const n8nUrl = new URL(N8N_WEBHOOK_URL)

  const res = await fetch(n8nUrl.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type":
        req.headers.get("content-type") || "application/json",
    },
    body,
    cache: "no-store",
  })

  const text = await res.text()

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "text/plain",
    },
  })
}
