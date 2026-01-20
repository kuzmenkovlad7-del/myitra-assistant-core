import { NextRequest, NextResponse } from "next/server"

function parseJsonOrForm(text: string): any {
  if (!text) return {}
  // пробуем JSON
  try {
    const j = JSON.parse(text)
    if (j && typeof j === "object") return j
  } catch {}

  // пробуем application/x-www-form-urlencoded
  try {
    const params = new URLSearchParams(text)
    const obj: any = {}
    params.forEach((v, k) => {
      obj[k] = v
    })
    return obj
  } catch {}

  return {}
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  const payload = parseJsonOrForm(text)

  // ВАЖНО: WayForPay ждёт любой валидный JSON-ответ
  // Мы всегда отвечаем ok, чтобы сервис не долбил ретраями
  return NextResponse.json({ ok: true, payload })
}
