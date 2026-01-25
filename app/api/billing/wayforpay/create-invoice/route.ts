import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Этот endpoint нужен только чтобы фронт получил invoiceUrl,
// а реальная оплата стартует через /api/billing/wayforpay/purchase
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin

  const body: any = await req.json().catch(() => ({}))
  const planId = String(body?.planId ?? "monthly").trim() || "monthly"

  const invoiceUrl = `${origin}/api/billing/wayforpay/purchase?planId=${encodeURIComponent(planId)}`

  return NextResponse.json(
    {
      ok: true,
      planId,
      invoiceUrl,
      url: invoiceUrl,
    },
    { status: 200 }
  )
}
