import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_API = "https://api.wayforpay.com/api"
const DEVICE_COOKIE = "ta_device_hash"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function mustEnv(name: string) {
  const v = env(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function hmacMd5(secret: string, msg: string) {
  return createHmac("md5", secret).update(msg).digest("hex")
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function noStore() {
  return { "cache-control": "no-store, max-age=0" }
}

function normalizeStatus(v: any) {
  return String(v || "").trim().toLowerCase()
}

function parseRaw(raw: any): any {
  if (!raw) return null
  try {
    let v: any = raw
    if (typeof v === "string") v = JSON.parse(v)
    if (typeof v === "string") v = JSON.parse(v)
    return v
  } catch {
    return null
  }
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function planDays(planId: string) {
  const p = String(planId || "").toLowerCase()
  if (p.includes("year")) return 365
  return 30
}

function addDaysISO(fromISO: string, days: number) {
  const d = new Date(fromISO)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

async function wfpCheckStatus(orderReference: string) {
  const merchantAccount =
    env("WAYFORPAY_MERCHANT_ACCOUNT") || env("WFP_MERCHANT_ACCOUNT")
  const secret =
    env("WAYFORPAY_SECRET_KEY") || env("WFP_SECRET_KEY") ||
    env("WAYFORPAY_MERCHANT_SECRET_KEY") || env("WFP_MERCHANT_SECRET_KEY")

  if (!merchantAccount || !secret) return { ok: false, error: "WAYFORPAY_NOT_CONFIGURED" }

  const signString = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5(secret, signString)

  const r = await fetch(WFP_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transactionType: "CHECK_STATUS",
      merchantAccount,
      orderReference,
      merchantSignature,
      apiVersion: 1,
    }),
    cache: "no-store",
  })

  const data = await r.json().catch(() => null as any)
  return { ok: r.ok, httpStatus: r.status, data }
}

async function ensureGrantForDevice(admin: any, deviceHash: string, planId: string) {
  if (!deviceHash) return null

  const now = new Date().toISOString()
  const days = planDays(planId)

  const cur = await admin
    .from("access_grants")
    .select("paid_until,user_id")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const base =
    cur.data?.paid_until && new Date(cur.data.paid_until).getTime() > Date.now()
      ? cur.data.paid_until
      : now

  const next = addDaysISO(base, days)

  await admin
    .from("access_grants")
    .upsert(
      {
        device_hash: deviceHash,
        user_id: cur.data?.user_id ?? null,
        paid_until: next,
        trial_questions_left: 0,
        updated_at: now,
      } as any,
      { onConflict: "device_hash" }
    )

  return next
}

async function handle(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const orderReference =
    (sp.get("orderReference") || sp.get("order_reference") || sp.get("order") || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400, headers: noStore() })
  }

  try {
    const admin = sbAdmin()
    const { data, error } = await admin
      .from("billing_orders")
      .select("order_reference,status,plan_id,amount,currency,device_hash,user_id,updated_at,raw")
      .eq("order_reference", orderReference)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: noStore() })
    }

    if (!data) {
      return NextResponse.json(
        { ok: true, found: false, orderReference, status: "not_found" },
        { status: 200, headers: noStore() }
      )
    }

    let status = normalizeStatus((data as any).status)
    let wfp: any = null

    // Self-healing: if order is pending/created, check WFP for real status
    if (status === "created" || status === "invoice_created" || status === "pending" || status === "processing") {
      wfp = await wfpCheckStatus(orderReference)

      const txStatus = wfp?.data?.transactionStatus || wfp?.data?.status || null
      const reasonCode = wfp?.data?.reasonCode || null

      const isPaid =
        txStatus === "Approved" ||
        txStatus === "approved" ||
        reasonCode === 1100 ||
        reasonCode === "1100"

      const isFailed =
        txStatus === "Declined" ||
        txStatus === "declined" ||
        txStatus === "Expired" ||
        txStatus === "expired" ||
        txStatus === "Refunded" ||
        txStatus === "refunded"

      if (isPaid) {
        status = "paid"
        await admin
          .from("billing_orders")
          .update({
            status: "paid",
            raw: { __event: "check_status_paid", wfp: wfp.data, prev: (data as any).status },
            updated_at: new Date().toISOString(),
          } as any)
          .eq("order_reference", orderReference)
      } else if (isFailed) {
        status = "failed"
        await admin
          .from("billing_orders")
          .update({
            status: "failed",
            raw: { __event: "check_status_failed", wfp: wfp.data, prev: (data as any).status },
            updated_at: new Date().toISOString(),
          } as any)
          .eq("order_reference", orderReference)
      }
    }

    // If paid, ensure access grants are extended
    let ensuredPaidUntil: string | null = null
    if (status === "paid") {
      const planId = String((data as any).plan_id || "monthly")
      const dh = String((data as any).device_hash || "")
      const uid = String((data as any).user_id || "").trim() || null

      if (dh) {
        ensuredPaidUntil = await ensureGrantForDevice(admin, dh, planId)
      }

      if (uid) {
        const accountKey = `account:${uid}`
        const pu2 = await ensureGrantForDevice(admin, accountKey, planId)
        if (pu2) {
          const a = toDateOrNull(ensuredPaidUntil)
          const b = toDateOrNull(pu2)
          ensuredPaidUntil = a && b && b.getTime() > a.getTime() ? pu2 : (ensuredPaidUntil || pu2)
        }

        // Sync profiles metadata
        if (ensuredPaidUntil) {
          try {
            await admin
              .from("profiles")
              .update({
                paid_until: ensuredPaidUntil,
                subscription_status: "active",
                auto_renew: true,
                cancel_at_period_end: false,
                canceled_at: null,
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", uid)
          } catch {}
        }
      }
    }

    const rawObj = parseRaw((data as any).raw)
    const transactionStatus = rawObj?.transactionStatus ?? rawObj?.transaction_status ?? null
    const reason = rawObj?.reason ?? rawObj?.message ?? null
    const reasonCode = rawObj?.reasonCode ?? rawObj?.reason_code ?? null

    return NextResponse.json(
      {
        ok: true,
        found: true,
        orderReference: (data as any).order_reference,
        planId: (data as any).plan_id ?? null,
        amount: (data as any).amount ?? null,
        currency: (data as any).currency ?? null,
        status,
        transactionStatus,
        reason,
        reasonCode,
        ensuredPaidUntil,
        updatedAt: (data as any).updated_at ?? null,
      },
      { status: 200, headers: noStore() }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "status failed", details: String(e?.message || e) },
      { status: 500, headers: noStore() }
    )
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
