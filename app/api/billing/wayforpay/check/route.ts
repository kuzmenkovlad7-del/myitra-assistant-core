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

  if (!url || !key) throw new Error("Missing SUPABASE envs for admin client");

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

async function checkStatus(orderReference: string) {
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderReference = url.searchParams.get("orderReference") || "";

  if (!orderReference) {
    return NextResponse.json(
      { ok: false, error: "missing_orderReference" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.log("[billing][wfp] checkStatus start", { orderReference });

  const result = await checkStatus(orderReference);

  if (!result.ok || !result.json) {
    console.log("[billing][wfp] checkStatus failed", result);
    return NextResponse.json(
      { ok: false, error: "wayforpay_check_failed", result },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const finalStatus = mapStatus(result.json.transactionStatus);

  try {
    const sb = getSupabaseAdmin();

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
      check: result.json,
      last_event: {
        source: "wayforpay_check",
        at: new Date().toISOString(),
        status: finalStatus,
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
      return NextResponse.json(
        { ok: false, error: "db_update_failed" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: finalStatus,
        orderReference,
        transactionStatus: result.json.transactionStatus,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.log("[billing][wfp] checkStatus exception", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
