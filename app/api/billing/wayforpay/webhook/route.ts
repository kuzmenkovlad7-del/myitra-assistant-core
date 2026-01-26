import { NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function hmacMd5HexUpper(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase()
}

function pick(body: any, key: string) {
  return body?.[key] ?? body?.[key.toUpperCase()] ?? ""
}

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}))

  const merchantAccount = String(pick(body, "merchantAccount"))
  const orderReference = String(pick(body, "orderReference"))
  const amount = String(pick(body, "amount"))
  const currency = String(pick(body, "currency"))
  const authCode = String(pick(body, "authCode"))
  const cardPan = String(pick(body, "cardPan"))
  const transactionStatus = String(pick(body, "transactionStatus"))
  const reasonCode = String(pick(body, "reasonCode"))
  const theirSignature = String(pick(body, "merchantSignature"))

  const secretKey = env("WAYFORPAY_SECRET_KEY") || env("WAYFORPAY_MERCHANT_SECRET_KEY")
  if (!orderReference || !theirSignature || !secretKey) {
    return NextResponse.json({ ok: false, error: "Bad webhook payload" }, { status: 400 })
  }

  // Проверяем подпись входящего вебхука от WayForPay:
  // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode :contentReference[oaicite:2]{index=2}
  const signString = [
    merchantAccount,
    orderReference,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  ].join(";")

  const ourSignature = hmacMd5HexUpper(signString, secretKey)
  if (ourSignature !== String(theirSignature).toUpperCase()) {
    return NextResponse.json(
      { ok: false, error: "Invalid webhook signature", ourSignature, theirSignature },
      { status: 400 }
    )
  }

  // Обновляем заказ в БД
  const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL")
  const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY")

  if (SUPABASE_URL && SERVICE_ROLE) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ordersTable = env("TA_ORDERS_TABLE") || "billing_orders"
    const norm = transactionStatus.toLowerCase()

    const status =
      norm === "approved" ? "paid" : norm === "refunded" ? "refunded" : norm === "declined" ? "failed" : norm

    await supabase
      .from(ordersTable)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("order_reference", orderReference)
  }

  // Отвечаем ACCEPT так, как требует WayForPay:
  // signature = HMAC_MD5(orderReference;status;time) :contentReference[oaicite:3]{index=3}
  const statusResp = "accept"
  const time = Math.floor(Date.now() / 1000).toString()
  const respSignString = [orderReference, statusResp, time].join(";")
  const signature = hmacMd5HexUpper(respSignString, secretKey)

  return NextResponse.json({
    orderReference,
    status: statusResp,
    time: Number(time),
    signature,
  })
}
