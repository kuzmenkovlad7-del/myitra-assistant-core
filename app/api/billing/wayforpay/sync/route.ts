import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_API_URL = "https://api.wayforpay.com/api"
const LAST_ORDER_COOKIE = "ta_last_order"

function env(name: string) {
  return String(process.env[name] || "").trim()
}
function mustEnv(name: string) {
  const v = env(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}
function hmacMd5Hex(str: string, key: string) {
  return createHmac("md5", key).update(str, "utf8").digest("hex")
}
function safeLower(v: any) {
  return String(v || "").trim().toLowerCase()
}
function mapTxToStatus(tx: string) {
  const s = safeLower(tx)
  if (s === "approved" || s === "paid" || s === "success" || s === "accept") return "paid"
  if (s === "refunded" || s === "voided" || s === "chargeback") return "refunded"
  if (s === "declined" || s === "expired" || s === "refused" || s === "rejected") return "failed"
  if (s === "pending" || s === "inprocessing" || s === "processing" || s === "created") return "pending"
  return s || "unknown"
}
function planDays(planId: string) {
  const p = safeLower(planId)
  if (p === "yearly" || p === "annual" || p === "year") return 365
  return 30
}
function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function extendPaidUntil(sb: any, key: string, days: number, userId: string | null) {
  const now = new Date()
  const nowIso = now.toISOString()

  const existing = await sb
    .from("access_grants")
    .select("paid_until")
    .eq("device_hash", key)
    .maybeSingle()

  const cur = toDateOrNull(existing?.data?.paid_until)
  const base = cur && cur.getTime() > now.getTime() ? cur : now
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  const paid_until = next.toISOString()

  const payload: any = {
    device_hash: key,
    paid_until,
    trial_questions_left: 0,
    updated_at: nowIso,
  }
  if (userId) payload.user_id = userId

  await sb.from("access_grants").upsert(payload, { onConflict: "device_hash" })
  return paid_until
}

async function getUserIdFromRequest(): Promise<string | null> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  if (!url || !anon) return null

  const jar = cookies()
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll() {},
    },
  })

  try {
    const { data } = await sb.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function wfpCheckStatus(orderReference: string) {
  const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
  const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")

  // request signature: merchantAccount;orderReference :contentReference[oaicite:13]{index=13}
  const reqSignString = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5Hex(reqSignString, secretKey)

  const payload = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature,
    apiVersion: 1,
  }

  const r = await fetch(WFP_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const j: any = await r.json().catch(() => ({}))
  return { ok: r.ok, httpStatus: r.status, body: j, merchantAccount, secretKey }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orderReference =
      String(sp.get("orderReference") || "").trim() ||
      String(cookies().get(LAST_ORDER_COOKIE)?.value || "").trim()

    if (!orderReference) {
      return NextResponse.json({ ok: false, error: "orderReference required" }, { status: 400 })
    }

    const sb = sbAdmin()
    const userIdFromCookie = await getUserIdFromRequest()

    const ord = await sb
      .from("billing_orders")
      .select("plan_id, device_hash, user_id, status")
      .eq("order_reference", orderReference)
      .maybeSingle()

    if (!ord.data) {
      return NextResponse.json({ ok: false, error: "order not found", orderReference }, { status: 404 })
    }

    const planId = String((ord.data as any).plan_id || "monthly")
    const deviceHash = String((ord.data as any).device_hash || "")
    const orderUserId = String((ord.data as any).user_id || "").trim() || null
    const userId = orderUserId || userIdFromCookie || null

    const chk = await wfpCheckStatus(orderReference)
    if (!chk.ok) {
      return NextResponse.json(
        { ok: false, error: "WayForPay CHECK_STATUS failed", httpStatus: chk.httpStatus, details: chk.body },
        { status: 502, headers: { "cache-control": "no-store" } }
      )
    }

    const tx = String(chk.body?.transactionStatus || chk.body?.status || "").trim()
    const status = mapTxToStatus(tx)

    // (опционально) проверим merchantSignature ответа:
    // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode :contentReference[oaicite:14]{index=14}
    const theirRespSig = String(chk.body?.merchantSignature || "").trim()
    if (theirRespSig) {
      const respSignString = [
        String(chk.body?.merchantAccount || chk.merchantAccount || ""),
        orderReference,
        String(chk.body?.amount || ""),
        String(chk.body?.currency || ""),
        String(chk.body?.authCode || ""),
        String(chk.body?.cardPan || ""),
        String(chk.body?.transactionStatus || ""),
        String(chk.body?.reasonCode || ""),
      ].join(";")

      const ourRespSig = hmacMd5Hex(respSignString, chk.secretKey)
      if (ourRespSig.toLowerCase() !== theirRespSig.toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: "Invalid CHECK_STATUS response signature", orderReference },
          { status: 502, headers: { "cache-control": "no-store" } }
        )
      }
    }

    await sb
      .from("billing_orders")
      .update({
        status,
        raw: JSON.stringify({ __event: "wayforpay_check_status", response: chk.body }),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    let paidUntil: string | null = null
    if (status === "paid") {
      const days = planDays(planId)
      if (deviceHash) paidUntil = await extendPaidUntil(sb, deviceHash, days, null)
      if (userId) {
        const accountKey = `account:${userId}`
        const pu2 = await extendPaidUntil(sb, accountKey, days, userId)
        paidUntil =
          paidUntil && toDateOrNull(paidUntil) && toDateOrNull(pu2) && toDateOrNull(pu2)!.getTime() > toDateOrNull(paidUntil)!.getTime()
            ? pu2
            : (paidUntil || pu2)

        try {
          await sb
            .from("profiles")
            .update({
              paid_until: paidUntil,
              subscription_status: "active",
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", userId)
        } catch {}
      }
    }

    return NextResponse.json(
      { ok: true, orderReference, status, paidUntil },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "sync failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
