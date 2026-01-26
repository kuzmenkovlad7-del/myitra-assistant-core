import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hmacMd5HexUpper(str: string, key: string) {
  return createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase();
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const secret = process.env.WFP_SECRET_KEY || process.env.WAYFORPAY_SECRET_KEY || "";
  const body = await req.json().catch(() => null);

  console.log("[WFP CALLBACK] incoming:", body);

  const merchantAccount = String(body?.merchantAccount || "");
  const orderReference = String(body?.orderReference || "");
  const amount = body?.amount;
  const currency = String(body?.currency || "");
  const authCode = String(body?.authCode || "");
  const cardPan = String(body?.cardPan || "");
  const transactionStatus = String(body?.transactionStatus || "");
  const reasonCode = String(body?.reasonCode || "");
  const incomingSignature = String(body?.merchantSignature || "");

  // Проверка подписи (если secret есть)
  let signatureOk = true;
  if (secret && merchantAccount && orderReference) {
    const signString = [
      merchantAccount,
      orderReference,
      String(amount ?? ""),
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(";");
    const expected = hmacMd5HexUpper(signString, secret);
    signatureOk = expected === incomingSignature.toUpperCase();
    console.log("[WFP CALLBACK] signature:", signatureOk ? "OK" : "BAD", { expected, incoming: incomingSignature });
  }

  // Обновляем заказ в Supabase
  const sb = getSupabaseAdmin();
  if (sb && orderReference) {
    const finalStatus =
      transactionStatus === "Approved"
        ? "paid"
        : transactionStatus
        ? String(transactionStatus).toLowerCase()
        : "callback_received";

    const updatePayload: any = {
      status: signatureOk ? finalStatus : "callback_signature_invalid",
      raw: body,
    };

    const { error } = await sb
      .from("billing_orders")
      .update(updatePayload)
      .eq("order_reference", orderReference);

    if (error) {
      console.log("[WFP CALLBACK] supabase update error:", error);
      // если не нашли строку - пробуем вставить
      const { error: insErr } = await sb.from("billing_orders").insert([
        {
          order_reference: orderReference,
          plan_id: body?.planId || "monthly",
          amount: Number(amount) || null,
          currency: currency || "UAH",
          status: signatureOk ? updatePayload.status : "callback_signature_invalid",
          raw: body,
        },
      ]);
      if (insErr) console.log("[WFP CALLBACK] supabase insert error:", insErr);
    }
  }

  // WayForPay ждёт ответ accept + signature по строке: orderReference;status;time
  const time = Math.floor(Date.now() / 1000);
  const status = "accept";
  const respString = `${orderReference};${status};${time}`;
  const signature = secret ? hmacMd5HexUpper(respString, secret) : "";

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
