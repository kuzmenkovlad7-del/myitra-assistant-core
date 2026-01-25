import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

function readCookie(req: NextRequest, names: string[]) {
  for (const n of names) {
    const v = req.cookies.get(n)?.value;
    if (v) return v;
  }
  return "";
}

async function extractOrderReference(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get("orderReference");
  if (fromQuery) return fromQuery;

  // form POST от WayForPay
  try {
    const fd = await req.formData();
    const v = fd.get("orderReference");
    if (typeof v === "string" && v) return v;
  } catch {}

  // json POST
  try {
    const j = await req.json();
    if (j?.orderReference) return String(j.orderReference);
  } catch {}

  // fallback cookie
  const fromCookie = readCookie(req, ["ta_last_order_reference"]);
  if (fromCookie) return fromCookie;

  return "";
}

function getAdmin() {
  const supabaseUrl = pickEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceKey = pickEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase admin env missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function setPaidUntilByDevice(deviceHash: string, days: number) {
  const admin = getAdmin();
  const now = new Date();
  const paidUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: row } = await admin
    .from("access_grants")
    .select("id, paid_until")
    .eq("device_hash", deviceHash)
    .maybeSingle();

  if (row?.id) {
    await admin.from("access_grants").update({ paid_until: paidUntil }).eq("id", row.id);
    return;
  }

  await admin.from("access_grants").insert({
    device_hash: deviceHash,
    trial_questions_left: 0,
    paid_until: paidUntil,
    promo_until: null,
  });
}

async function checkStatus(merchantAccount: string, secretKey: string, orderReference: string) {
  // Signature string for CHECK_STATUS: merchantAccount;orderReference
  const signString = [merchantAccount, orderReference].join(";");
  const merchantSignature = hmacMd5Hex(secretKey, signString);

  const payload = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature,
    apiVersion: 1,
  };

  const r = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return r.json();
}

async function handle(req: NextRequest) {
  const origin = getOrigin(req);

  const merchantAccount = pickEnv(
    "WAYFORPAY_MERCHANT_ACCOUNT",
    "WAYFORPAY_ACCOUNT",
    "WFP_MERCHANT_ACCOUNT"
  );
  const secretKey = pickEnv(
    "WAYFORPAY_MERCHANT_SECRET_KEY",
    "WAYFORPAY_SECRET_KEY",
    "WAYFORPAY_SECRET",
    "WFP_SECRET_KEY"
  );

  const deviceHash =
    readCookie(req, ["turbota_device", "turbota_device_hash", "device_hash"]) ||
    crypto.randomUUID();

  const orderReference = await extractOrderReference(req);

  // если вообще нет orderReference — просто в профиль
  if (!orderReference) {
    const res = NextResponse.redirect(new URL("/profile", origin), 302);
    res.cookies.set("turbota_device", deviceHash, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set("device_hash", deviceHash, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    res.headers.set("cache-control", "no-store, max-age=0");
    return res;
  }

  let status = "unknown";
  let wfpResp: any = null;

  if (merchantAccount && secretKey) {
    try {
      wfpResp = await checkStatus(merchantAccount, secretKey, orderReference);
      status = String(wfpResp?.transactionStatus || "").toLowerCase();
    } catch {
      status = "error";
    }
  }

  // Approved -> даём доступ на 30 дней
  if (status === "approved") {
    try {
      await setPaidUntilByDevice(deviceHash, 30);
    } catch {}
  }

  const target = `/profile?orderReference=${encodeURIComponent(orderReference)}&status=${encodeURIComponent(status)}`;
  const res = NextResponse.redirect(new URL(target, origin), 302);

  res.cookies.set("turbota_device", deviceHash, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set("device_hash", deviceHash, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set("ta_last_order_reference", orderReference, { path: "/", maxAge: 60 * 30 });

  res.headers.set("cache-control", "no-store, max-age=0");
  return res;
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
