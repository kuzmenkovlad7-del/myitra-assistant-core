import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const planId = String(req.nextUrl.searchParams.get("planId") || "monthly").trim()

  const origin = req.nextUrl.origin

  const r = await fetch(`${origin}/api/billing/wayforpay/create-invoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId }),
    cache: "no-store",
  }).catch(() => null)

  const json: any = await r?.json().catch(() => null)
  const url = String(json?.url ?? "").trim()

  if (!url) {
    return NextResponse.redirect(new URL(`/pricing?pay=error`, origin), { status: 302 })
  }

  return NextResponse.redirect(url, { status: 302 })
}
