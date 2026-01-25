import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // Только явный logout по кнопке
  const okHeader = req.headers.get("x-ta-logout") === "1"
  const res = NextResponse.json({ ok: true, cleared: okHeader }, { status: 200 })

  if (!okHeader) return res

  // чистим только auth cookies (sb-*)
  const cookies = req.cookies.getAll()
  for (const c of cookies) {
    const name = c.name

    // оставляем device/технические куки приложения
    if (name.startsWith("ta_")) continue

    if (name.startsWith("sb-") || name.includes("supabase") || name.includes("auth")) {
      res.cookies.set(name, "", { path: "/", maxAge: 0 })
    }
  }

  return res
}
