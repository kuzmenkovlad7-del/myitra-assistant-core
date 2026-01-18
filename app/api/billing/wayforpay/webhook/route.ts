import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";

  if (!url || !key) {
    throw new Error("Missing SUPABASE envs for admin client");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hmacMd5(data: string, secret: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

function getWfpEnv() {
  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    "";

  const secret =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET ||
    "";

  return { merchantAccount, secret };
}

function mapStatus(transactionStatus?: string) {
  const st = String(transactionStatus || "").toLowerCase();

  if (st === "approved") return "paid";
  if (st === "inprocessing" || st === "processing" || st === "pending") return "processing";
  if (st === "declined" || st === "expired" || st === "refunded" || st === "voided" || st === "rejected")
    return "failed";

  return "processing";
}

async function readBodyAny(req: Request): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const out: Record<string, any> = {};
      fd.forEach((v, k) => (out[k] = typeof v === "string" ? v : "[file]"));

      if (out.data && typeof out.data === "string") {
        const t = out.data.trim();
        if (t.startsWith("{")) {
          try {
            return JSON.parse(t);
          } catch {}
        }
      }

      return out;
    }

    const text = await req.text().catch(() => "");
    const trimmed = text.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return JSON.parse(trimmed);
      } catch {}
    }

    const params = new URLSearchParams(text);
    const obj: Record<string, any> = {};
    params.forEach((v, k) => (obj[k] = v));

    // кейс: тело = один ключ, который является JSON-строкой
    if (Object.keys(obj).length === 1) {
      const onlyKey = Object.keys(obj)[0];
      const maybeJson = onlyKey.trim();
      if (maybeJson.startsWith("{") && maybeJson.endsWith("}")) {
        try {
          return JSON.parse(maybeJson);
        } catch {}
      }
    }

    return obj;
  } catch {
    return {};
  }
}

function normalizePayload(body: any) {
  // иногда мы сами сохраняем как { webhook: {...} }
  if (body?.webhook && typeof body.webhook === "object") return body.webhook;
  return body || {};
}

function verifyWebhookSignature(payload: any, secret: string) {
  // согласно докам: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
  const signature = String(payload?.merchantSignature || "");
  if (!signature || !secret) return true;

  const signString = [
    payload.merchantAccount ?? "",
    payload.orderReference ?? "",
    String(payload.amount ?? ""),
    payload.currency ?? "",
    payload.authCode ?? "",
    payload.cardPan ?? "",
    payload.transactionStatus ?? "",
    String(payload.reasonCode ?? ""),
  ].join(";");

  const expected = hmacMd5(signString, secret);
  return expected === signature;
}

function acceptResponse(orderReference: string, secret: string) {
  const status = "accept";
  const time = Math.floor(Date.now() / 1000);
  const signature = hmacMd5(`${orderReference};${status};${time}`, secret);

  return {
    orderReference,
    status,
    time,
    signature,
  };
}

async function wfpCheckStatus(orderReference: string) {
  const { merchantAccount, secret } = getWfpEnv();
  if (!merchantAccount || !secret) {
    return { ok: false, error: "missing_wfp_env" as const };
  }

  const payload = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    apiVersion: 1,
    orderReference,
    merchantSignature: hmacMd5(`${merchantAccount};${orderReference}`, secret),
  };

  const res = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);

  return {
    ok: res.ok,
    httpStatus: res.status,
    json,
  };
}

export async function POST(req: Request) {
  const rawBody = await readBodyAny(req);
  const payload = normalizePayload(rawBody);

  const orderReference =
    payload.orderReference ||
    payload.order_reference ||
    "";

  const { secret } = getWfpEnv();

  if (!orderReference) {
    console.log("[billing][wfp] webhook missing orderReference", { rawBody });
    return NextResponse.json(
      { ok: false, error: "missing_orderReference" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const signatureOk = verifyWebhookSignature(payload, secret);

  console.log("[billing][wfp] webhook received", {
    orderReference,
    transactionStatus: payload.transactionStatus,
    reasonCode: payload.reasonCode,
    signatureOk,
  });

  // статус из webhook (если подпись ок)
  let finalPayload: any = payload;
  let finalStatus = mapStatus(payload.transactionStatus);

  // если подпись не сошлась — НЕ ломаем оплату пользователю,
  // а проверяем через API WayForPay (истина)
  let checkResult: any = null;
  if (!signatureOk) {
    console.log("[billing][wfp] signature invalid -> checkStatus", { orderReference });
    checkResult = await wfpCheckStatus(orderReference);
    if (checkResult?.ok && checkResult?.json) {
      finalStatus = mapStatus(checkResult.json.transactionStatus);
      finalPayload = {
        ...finalPayload,
        _checkStatus: checkResult.json,
      };
    }
  }

  try {
    const sb = getSupabaseAdmin();

    // получаем прошлый raw, чтобы не терять историю
    const existing = await sb
      .from("billing_orders")
      .select("raw")
      .eq("order_reference", orderReference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevRaw = (existing.data?.raw as any) || {};

    const mergedRaw = {
      ...prevRaw,
      webhook: finalPayload,
      last_event: {
        source: "wayforpay_webhook",
        at: new Date().toISOString(),
        status: finalStatus,
        signatureOk,
        checkedByApi: Boolean(checkResult),
      },
    };

    const upd = await sb
      .from("billing_orders")
      .update({
        status: finalStatus,
        raw: mergedRaw,
      })
      .eq("order_reference", orderReference);

    if (upd.error) {
      console.log("[billing][wfp] supabase update error", { orderReference, error: upd.error });
      // пусть WFP ретраит — у нас проблема с базой
      return NextResponse.json(
        { ok: false, error: "db_update_failed" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const resp = acceptResponse(orderReference, secret);
    return NextResponse.json(resp, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.log("[billing][wfp] exception", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
