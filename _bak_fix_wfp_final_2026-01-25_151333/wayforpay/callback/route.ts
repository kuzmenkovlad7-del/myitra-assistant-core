import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

export async function POST(req: NextRequest) {
  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    process.env.WAYFORPAY_ACCOUNT

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET

  const body = (await req.json().catch(() => null)) as any
  const orderReference = String(body?.orderReference ?? "").trim()

  // Ответ WayForPay: orderReference;status;time -> HMAC_MD5 :contentReference[oaicite:3]{index=3}
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"

  if (!merchantAccount || !secretKey || !orderReference) {
    // даже если что-то не так, отвечаем корректно, чтобы WFP не ретраил 4 дня
    const signature = secretKey ? hmacMd5([orderReference || "unknown", status, time].join(";"), secretKey) : ""
    return NextResponse.json({ orderReference: orderReference || "unknown", status, time, signature }, { status: 200 })
  }

  // Проверка подписи входящего webhook
  // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode :contentReference[oaicite:4]{index=4}
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

  // если подпись не совпала — мы всё равно отвечаем accept,
  // но НЕ считаем это гарантированным подтверждением оплаты.
  // Реальное подтверждение делает /sync через CHECK_STATUS.
  const signature = hmacMd5([orderReference, status, time].join(";"), secretKey)

  return NextResponse.json(
    {
      orderReference,
      status,
      time,
      signature,
      verified: got && got === expected,
      transactionStatus: String(body?.transactionStatus ?? ""),
    },
    { status: 200 }
  )
}
