import { NextResponse } from "next/server";
import crypto, { createHmac } from "crypto";
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

function addMonthsIso(months: number) {
  const d = new Date();
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // защита от перепрыгивания на следующий месяц при коротком месяце
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString();
}

async function readBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null);
    return j && typeof j === "object" ? j : null;
  }

  // WayForPay часто присылает form-data или x-www-form-urlencoded
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return null;
    const obj: any = {};
    fd.forEach((v, k) => {
      const value = typeof v === "string" ? v : String(v);
      if (obj[k] === undefined) obj[k] = value;
      else if (Array.isArray(obj[k])) obj[k].push(value);
      else obj[k] = [obj[k], value];
    });
    return obj;
  }

  // fallback
  const txt = await req.text().catch(() => "");
  if (!txt) return null;
  return { rawText: txt };
}

export async function POST(req: Request) {
  const secret = process.env.WAYFORPAY_SECRET_KEY || process.env.WFP_SECRET_KEY || "";
  const body = await readBody(req);

  console.log("[WFP CALLBACK] incoming:", body);

  const merchantAccount = String((body as any)?.merchantAccount || "");
  const orderReference = String((body as any)?.orderReference || "");
  const amount = (body as any)?.amount;
  const currency = String((body as any)?.currency || "");
  const authCode = String((body as any)?.authCode || "");
  const cardPan = String((body as any)?.cardPan || "");
  const transactionStatus = String((body as any)?.transactionStatus || "");
  const reasonCode = String((body as any)?.reasonCode || "");
  const incomingSignature = String((body as any)?.merchantSignature || "");

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

  const sb = getSupabaseAdmin();

  // 1) Обновляем billing_orders
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
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from("billing_orders").update(updatePayload).eq("order_reference", orderReference);

    if (error) {
      console.log("[WFP CALLBACK] billing_orders update error:", error);
      const { error: insErr } = await sb.from("billing_orders").insert([
        {
          order_reference: orderReference,
          plan_id: (body as any)?.planId || "monthly",
          amount: Number(amount) || null,
          currency: currency || "UAH",
          status: updatePayload.status,
          raw: body,
          updated_at: updatePayload.updated_at,
        },
      ]);
      if (insErr) console.log("[WFP CALLBACK] billing_orders insert error:", insErr);
    }
  }

  // 2) Если Approved и подпись ок, выдаём доступ в access_grants по device_hash из billing_orders
  if (sb && signatureOk && transactionStatus === "Approved" && orderReference) {
    try {
      const { data: ord } = await sb
        .from("billing_orders")
        .select("device_hash,plan_id")
        .eq("order_reference", orderReference)
        .maybeSingle();

      const deviceHash = String((ord as any)?.device_hash || "");
      const planId = String((ord as any)?.plan_id || "monthly");

      if (deviceHash) {
        const paidUntil = planId === "monthly" ? addMonthsIso(1) : addMonthsIso(1);
        const nowIso = new Date().toISOString();

        const { data: existing } = await sb
          .from("access_grants")
          .select("id")
          .eq("device_hash", deviceHash)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await sb
            .from("access_grants")
            .update({
              paid_until: paidUntil,
              updated_at: nowIso,
            })
            .eq("id", existing.id);
        } else {
          await sb.from("access_grants").insert({
            id: crypto.randomUUID(),
            user_id: null,
            device_hash: deviceHash,
            trial_questions_left: 0,
            paid_until: paidUntil,
            promo_until: null,
            created_at: nowIso,
            updated_at: nowIso,
          });
        }

        console.log("[WFP CALLBACK] access_grants updated:", { deviceHash, paidUntil, planId });
      } else {
        console.log("[WFP CALLBACK] no device_hash for orderReference", orderReference);
      }
    } catch (e: any) {
      console.log("[WFP CALLBACK] access_grants update failed:", String(e?.message || e));
    }
  }

  // 3) Ответ accept + signature
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
