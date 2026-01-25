import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin

  const body: any = await req.json().catch(() => ({}))
  const planId = String(body?.planId ?? "monthly").trim() || "monthly"

  const orderReference = `ta_${planId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const invoiceUrl = `${origin}/api/billing/wayforpay/purchase?planId=${encodeURIComponent(
    planId
  )}&orderReference=${encodeURIComponent(orderReference)}`

  return NextResponse.json(
    {
      ok: true,
      planId,
      orderReference,
      invoiceUrl,
      url: invoiceUrl,
    },
    { status: 200 }
  )
}
