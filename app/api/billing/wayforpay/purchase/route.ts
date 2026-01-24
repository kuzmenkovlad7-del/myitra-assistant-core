import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

function ensureDeviceHash(req: NextRequest) {
  const existing = readCookie(req, ["turbota_device", "turbota_device_hash", "device_hash"]);
  if (existing) return existing;
  return crypto.randomUUID();
}

function planConfig(plan: string | null) {
  const p = (plan || "monthly").toLowerCase();
  if (p === "monthly") {
    return {
      plan: "monthly",
      amount: 499,
      currency: "UAH",
      days: 30,
      productName: "TurbotaAI Monthly",
    };
  }
  // default
  return {
    plan: "monthly",
    amount: 499,
    currency: "UAH",
    days: 30,
    productName: "TurbotaAI Monthly",
  };
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

  if (!merchantAccount || !secretKey) {
    return NextResponse.json(
      { ok: false, error: "WayForPay env missing: merchant account / secret key" },
      { status: 500 }
    );
  }

  const deviceHash = ensureDeviceHash(req);

  let body: any = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const planParam =
    req.nextUrl.searchParams.get("plan") ||
    body?.plan ||
    body?.tier ||
    "monthly";

  const cfg = planConfig(String(planParam));
  const orderReference = `ta_${cfg.plan}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const orderDate = Math.floor(Date.now() / 1000);

  const merchantDomainName =
    pickEnv("WAYFORPAY_MERCHANT_DOMAIN_NAME", "WAYFORPAY_DOMAIN") ||
    new URL(origin).host;

  const productName = [cfg.productName];
  const productCount = [1];
  const productPrice = [cfg.amount];

  // Signature string for CREATE_INVOICE:
  // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName;productCount;productPrice
  const signString = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    String(cfg.amount),
    cfg.currency,
    ...productName.map(String),
    ...productCount.map((x) => String(x)),
    ...productPrice.map((x) => String(x)),
  ].join(";");

  const merchantSignature = hmacMd5Hex(secretKey, signString);

  const returnUrl = `${origin}/payment/return?orderReference=${encodeURIComponent(orderReference)}`;
  const serviceUrl = `${origin}/api/billing/wayforpay/webhook`; // можно оставить, даже если пока не используешь

  const payload = {
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantDomainName,
    merchantSignature,
    apiVersion: 1,
    orderReference,
    orderDate,
    amount: cfg.amount,
    currency: cfg.currency,
    productName,
    productCount,
    productPrice,
    serviceUrl,
    returnUrl,
    language: "UA",
  };

  let wfp: any = null;
  try {
    const r = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    wfp = await r.json();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "WayForPay request failed", details: String(e?.message || e) },
      { status: 500 }
    );
  }

  const invoiceUrl = wfp?.invoiceUrl || wfp?.payUrl || wfp?.url || null;

  const res = NextResponse.json(
    {
      ok: !!invoiceUrl,
      plan: cfg.plan,
      amount: cfg.amount,
      currency: cfg.currency,
      orderReference,
      invoiceUrl,
      paymentUrl: invoiceUrl,     // совместимость
      redirectUrl: invoiceUrl,    // совместимость
      deviceHash,
      wfp,
    },
    { status: invoiceUrl ? 200 : 500 }
  );

  // фиксируем device и последний order
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
