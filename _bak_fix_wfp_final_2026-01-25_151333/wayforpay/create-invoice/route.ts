import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

const PLANS: Record<string, { title: string; amount: number; currency: string }> = {
  monthly: { title: "TurbotaAI Monthly", amount: 1, currency: "UAH" },
}

export async function POST(req: NextRequest) {
  const { planId } = (await req.json().catch(() => ({}))) as any

  const planKey = String(planId || "monthly").trim()
  const plan = PLANS[planKey]

  if (!plan) {
    return NextResponse.json({ ok: false, message: "Unknown planId" }, { status: 200 })
  }

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    process.env.WAYFORPAY_ACCOUNT

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET

  if (!merchantAccount || !secretKey) {
    return NextResponse.json({ ok: false, message: "WayForPay env is missing" }, { status: 200 })
  }

  const origin = req.nextUrl.origin
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME || req.nextUrl.hostname

  const orderDate = Math.floor(Date.now() / 1000)
  const orderReference = `ta_${planKey}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`

  const amount = Number(plan.amount)
  const currency = String(plan.currency || "UAH")
  const productName = [plan.title]
  const productCount = [1]
  const productPrice = [amount]

  // ВАЖНО: returnUrl - страница (GET)
  // serviceUrl - webhook (POST)
  const returnUrl = `${origin}/payment/result?orderReference=${encodeURIComponent(orderReference)}`
  const serviceUrl = `${origin}/api/billing/wayforpay/callback`

  // merchantSignature for PURCHASE:
  // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName..;productCount..;productPrice..
  const signStr = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    String(amount),
    currency,
    ...productName,
    ...productCount.map(String),
    ...productPrice.map(String),
  ].join(";")

  const merchantSignature = hmacMd5(signStr, secretKey)

  const payload: any = {
    merchantAccount,
    merchantDomainName,
    merchantSignature,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
    returnUrl,
    serviceUrl,
    language: "RU",
  }

  // Mobile/offline flow -> returns { url: "https://secure.wayforpay.com/page?vkh=..." } :contentReference[oaicite:6]{index=6}
  const r = await fetch("https://secure.wayforpay.com/pay?behavior=offline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null)

  const json: any = await r?.json().catch(() => null)
  const url = String(json?.url ?? "").trim()

  if (!url) {
    return NextResponse.json({ ok: false, message: "WayForPay: no url in response", debug: json ?? null }, { status: 200 })
  }

  return NextResponse.json({ ok: true, url, orderReference, planId: planKey }, { status: 200 })
}
