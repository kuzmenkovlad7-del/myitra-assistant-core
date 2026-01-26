import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function env(name: string) {
  return (process.env[name] || "").trim()
}

function stripQuotes(v: string) {
  // на всякий случай если кто-то вставил "secret" в env
  if (!v) return v
  const s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim()
  }
  return s
}

function hmacMd5HexUpper(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase()
}

function escHtml(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function randomHex(len = 8) {
  return crypto.randomBytes(len).toString("hex")
}

function fmtAmount(n: number) {
  if (!Number.isFinite(n)) return "1"
  // 499 -> "499"
  // 499.5 -> "499.50" -> "499.5"
  const s = n.toFixed(2)
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}

async function handler(req: Request) {
  const url = new URL(req.url)

  const debug = url.searchParams.get("debug") === "1"

  const planId = String(url.searchParams.get("planId") || "monthly")
  const orderReference = String(
    url.searchParams.get("orderReference") || `ta_${planId}_${Date.now()}_${randomHex(6)}`
  )

  const origin = url.origin

  const merchantAccount = stripQuotes(env("WAYFORPAY_MERCHANT_ACCOUNT"))
  const secretKeyRaw =
    env("WAYFORPAY_SECRET_KEY") ||
    env("WAYFORPAY_SECRET") ||
    env("WAYFORPAY_MERCHANT_SECRET_KEY")

  const secretKey = stripQuotes(secretKeyRaw)

  // ВАЖНО: hostname, не host (host может быть с портом)
  const merchantDomainName =
    stripQuotes(env("WAYFORPAY_MERCHANT_DOMAIN_NAME")) ||
    new URL(env("NEXT_PUBLIC_APP_URL") || origin).hostname

  const serviceUrl =
    stripQuotes(env("WAYFORPAY_WEBHOOK_URL")) ||
    `${origin}/api/billing/wayforpay/webhook`

  const returnUrl =
    stripQuotes(env("WAYFORPAY_RETURN_URL")) ||
    `${origin}/payment/result?orderReference=${encodeURIComponent(orderReference)}`

  const monthlyPrice = Number(env("TA_MONTHLY_PRICE_UAH") || "1")
  const amountNum = planId === "monthly" ? monthlyPrice : monthlyPrice

  const amount = fmtAmount(amountNum)
  const currency = "UAH"
  const orderDate = Math.floor(Date.now() / 1000).toString()

  const productName = ["TurbotaAI Monthly"]
  const productCount = ["1"]
  const productPrice = [amount]

  const ck = cookies()
  const existingDevice = ck.get("ta_device_hash")?.value
  const deviceHash = existingDevice || crypto.randomUUID()

  console.log("[WFP PURCHASE] merchantAccount=", merchantAccount)
  console.log("[WFP PURCHASE] merchantDomainName=", merchantDomainName)
  console.log("[WFP PURCHASE] orderReference=", orderReference)
  console.log("[WFP PURCHASE] amount=", amount, currency)
  console.log("[WFP PURCHASE] serviceUrl=", serviceUrl)
  console.log("[WFP PURCHASE] returnUrl=", returnUrl)
  console.log("[WFP PURCHASE] secretKeyLen=", secretKey ? secretKey.length : 0)

  if (!merchantAccount || !secretKey) {
    console.error("[WFP PURCHASE] Missing merchantAccount or secretKey")
    return NextResponse.json(
      { ok: false, error: "Missing WAYFORPAY_MERCHANT_ACCOUNT or WAYFORPAY_SECRET_KEY" },
      { status: 500 }
    )
  }

  const signString = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    ...productName,
    ...productCount,
    ...productPrice,
  ].join(";")

  const merchantSignature = hmacMd5HexUpper(signString, secretKey)

  console.log("[WFP PURCHASE] signString=", signString)
  console.log("[WFP PURCHASE] merchantSignature=", merchantSignature)

  // debug режим: покажем всё прямо в браузере (без секрета)
  if (debug) {
    return NextResponse.json({
      ok: true,
      merchantAccount,
      merchantDomainName,
      orderReference,
      orderDate,
      amount,
      currency,
      signString,
      merchantSignature,
    })
  }

  // пишем заказ в БД (не ломает оплату)
  const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL")
  const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY")
  const ordersTable = env("TA_ORDERS_TABLE") || "billing_orders"

  if (SUPABASE_URL && SERVICE_ROLE) {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const userId = ck.get("ta_user_id")?.value || null

      await supabase.from(ordersTable).upsert(
        {
          order_reference: orderReference,
          user_id: userId,
          device_hash: deviceHash,
          plan_id: planId,
          amount: amountNum.toString(),
          currency,
          status: "invoice_created",
          raw: JSON.stringify({
            planId,
            orderReference,
            created_at: new Date().toISOString(),
            deviceHash,
            last_event: "purchase",
          }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_reference" }
      )
    } catch (e: any) {
      console.error("[WFP PURCHASE] DB upsert failed:", e?.message || e)
    }
  }

  const baseInputsObj: Record<string, string> = {
    merchantAccount,
    merchantAuthType: "SimpleSignature",
    merchantDomainName,
    merchantSignature,
    orderReference,
    orderDate,
    amount,
    currency,
    serviceUrl,
    returnUrl,
    language: "UA",
  }

  const baseInputs = Object.entries(baseInputsObj)
    .map(([k, v]) => `<input type="hidden" name="${escHtml(k)}" value="${escHtml(v)}">`)
    .join("\n")

  const arrInputs =
    productName.map((v) => `<input type="hidden" name="productName[]" value="${escHtml(v)}">`).join("\n") +
    "\n" +
    productCount.map((v) => `<input type="hidden" name="productCount[]" value="${escHtml(v)}">`).join("\n") +
    "\n" +
    productPrice.map((v) => `<input type="hidden" name="productPrice[]" value="${escHtml(v)}">`).join("\n")

  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Оплата</title>
</head>
<body style="font-family: system-ui; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 8px;">Перенаправляємо на оплату…</h2>
    <div style="opacity: .7; font-size: 14px;">Якщо нічого не відбувається — натисніть кнопку нижче.</div>

    <form id="wfpForm" method="POST" action="https://secure.wayforpay.com/pay" accept-charset="utf-8" style="margin-top: 16px;">
      ${baseInputs}
      ${arrInputs}
      <button type="submit" style="padding: 12px 16px; border-radius: 12px; border: 1px solid #ddd; background: #111; color: #fff; width: 100%;">
        Перейти до оплати
      </button>
    </form>
  </div>

  <script>
    setTimeout(() => {
      const f = document.getElementById("wfpForm");
      if (f) f.submit();
    }, 50);
  </script>
</body>
</html>`

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })

  res.cookies.set("ta_last_order", orderReference, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  })

  res.cookies.set("ta_device_hash", deviceHash, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  return res
}

export async function GET(req: Request) {
  return handler(req)
}

export async function POST(req: Request) {
  return handler(req)
}
