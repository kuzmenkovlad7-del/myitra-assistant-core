import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str).digest("hex")
}

function envAny(...keys: string[]) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim()
    if (v) return v
  }
  return ""
}

export async function POST(req: NextRequest) {
  const secretKey = envAny("WAYFORPAY_SECRET_KEY", "WFP_SECRET_KEY", "WAYFORPAY_SECRET")
  const merchantAccount = envAny("WAYFORPAY_MERCHANT_ACCOUNT", "WFP_MERCHANT_ACCOUNT", "WAYFORPAY_ACCOUNT")

  const contentType = req.headers.get("content-type") || ""
  let body: any = null

  if (contentType.includes("application/json")) {
    body = await req.json().catch(() => null)
  } else {
    const text = await req.text().catch(() => "")
    if (text) {
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    }
  }

  const orderReference = String(body?.orderReference ?? body?.order_reference ?? "").trim()

  // WayForPay ждёт ответ: orderReference;status;time -> HMAC_MD5
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"

  const signature = secretKey ? hmacMd5([orderReference || "unknown", status, time].join(";"), secretKey) : ""

  // Проверяем подпись входящего запроса если есть
  let verified = false
  try {
    if (secretKey && body?.merchantSignature && merchantAccount) {
      const signStr = [
        String(body?.merchantAccount ?? ""),
        String(body?.orderReference ?? ""),
        String(body?.amount ?? ""),
        String(body?.currency ?? ""),
        String(body?.authCode ?? ""),
        String(body?.cardPan ?? ""),
        String(body?.transactionStatus ?? ""),
        String(body?.reasonCode ?? ""),
      ].join(";")

      const expected = hmacMd5(signStr, secretKey)
      const got = String(body?.merchantSignature ?? "")
      verified = !!got && got === expected
    }
  } catch {}

  return NextResponse.json(
    {
      orderReference: orderReference || "unknown",
      status,
      time,
      signature,
      verified,
      transactionStatus: String(body?.transactionStatus ?? ""),
      merchantAccount: String(body?.merchantAccount ?? merchantAccount ?? ""),
    },
    { status: 200 }
  )
}
