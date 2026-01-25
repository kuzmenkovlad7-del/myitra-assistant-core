import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function planConfig(planId: string) {
  // Можно потом расширить
  const testAmount = Number(process.env.WAYFORPAY_TEST_AMOUNT_UAH ?? 1)

  if (planId === "yearly") {
    return {
      planId: "yearly",
      title: "TurbotaAI Yearly",
      amount: testAmount,
      currency: "UAH",
    }
  }

  return {
    planId: "monthly",
    title: "TurbotaAI Monthly",
    amount: testAmount,
    currency: "UAH",
  }
}

export async function GET(req: NextRequest) {
  const planId = String(req.nextUrl.searchParams.get("planId") || "monthly").trim() || "monthly"

  const merchantAccount = String(process.env.WAYFORPAY_MERCHANT_ACCOUNT || "").trim()
  const secretKey = String(process.env.WAYFORPAY_SECRET_KEY || "").trim()
  const merchantDomainName = String(process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME || "").trim()

  if (!merchantAccount || !secretKey || !merchantDomainName) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay env missing",
        need: ["WAYFORPAY_MERCHANT_ACCOUNT", "WAYFORPAY_SECRET_KEY", "WAYFORPAY_MERCHANT_DOMAIN_NAME"],
      },
      { status: 500 }
    )
  }

  const plan = planConfig(planId)

  const orderReference = `ta_${plan.planId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const orderDate = Math.floor(Date.now() / 1000)

  const amount = Number(plan.amount)
  const currency = String(plan.currency)

  const productName = [plan.title]
  const productCount = [1]
  const productPrice = [amount]

  // returnUrl и serviceUrl (callback) по доке Purchase
  // returnUrl вернет пользователя назад на сайт после оплаты
  // serviceUrl дергается сервером WFP и подтверждает оплату
  const returnBase = String(process.env.WAYFORPAY_RETURN_URL || `${req.nextUrl.origin}/payment/return`).trim()
  const serviceUrl = String(process.env.WAYFORPAY_WEBHOOK_URL || `${req.nextUrl.origin}/api/billing/wayforpay/webhook`).trim()

  const returnUrl = `${returnBase}?orderReference=${encodeURIComponent(orderReference)}`

  // Подпись по доке Purchase: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;...arrays...
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

  // Важно: merchantTransactionType = SALE, чтобы не было холда и странных откатов
  // В WayForPay есть AUTO/AUTH/SALE, нам нужен SALE для реального списания
  // Это есть в доках Create invoice и Purchase. :contentReference[oaicite:1]{index=1}
  const fields: Record<string, any> = {
    merchantAccount,
    merchantDomainName,
    merchantSignature,
    orderReference,
    orderDate,
    amount,
    currency,
    "productName[]": productName[0],
    "productCount[]": productCount[0],
    "productPrice[]": productPrice[0],
    returnUrl,
    serviceUrl,
    language: "RU",
    merchantTransactionType: "SALE",
  }

  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("\n")

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Оплата</title>
</head>
<body style="font-family: system-ui; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 8px;">Перенаправляем на оплату…</h2>
    <div style="opacity: .7; font-size: 14px;">Если ничего не происходит, нажмите кнопку ниже.</div>

    <form id="wfpForm" method="POST" action="https://secure.wayforpay.com/pay" style="margin-top: 16px;">
      ${inputs}
      <button type="submit" style="padding: 12px 16px; border-radius: 12px; border: 1px solid #ddd; background: #111; color: #fff; width: 100%;">
        Перейти к оплате
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

  // Сохраняем чек-код на устройстве
  res.cookies.set("ta_last_order", orderReference, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  })

  return res
}
