import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str).digest("hex")
}

function envAny(...keys: string[]) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim()
    if (v) return v
  }
  return ""
}

function getDeviceHash() {
  const jar = cookies()
  const existing =
    jar.get("ta_device")?.value ||
    jar.get("ta_device_hash")?.value ||
    jar.get("device_hash")?.value ||
    jar.get("deviceHash")?.value ||
    ""

  if (existing) return existing

  const v = crypto.randomUUID()
  jar.set("ta_device", v, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 год
  })
  return v
}

function supabaseAdmin() {
  const url = envAny("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
  const key = envAny("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")
  if (!url || !key) throw new Error("Supabase env missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as any
  const orderReference = String(body?.orderReference ?? "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, message: "orderReference is required" }, { status: 200 })
  }

  const merchantAccount = envAny("WAYFORPAY_MERCHANT_ACCOUNT", "WFP_MERCHANT_ACCOUNT", "WAYFORPAY_ACCOUNT")
  const secretKey = envAny("WAYFORPAY_SECRET_KEY", "WFP_SECRET_KEY", "WAYFORPAY_SECRET")

  if (!merchantAccount || !secretKey) {
    return NextResponse.json({ ok: false, message: "WayForPay env is missing" }, { status: 200 })
  }

  const signStr = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5(signStr, secretKey)

  const wfpBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature,
    apiVersion: 1,
  }

  const r = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(wfpBody),
    cache: "no-store",
  }).catch(() => null)

  const json: any = await r?.json().catch(() => null)
  const status = String(json?.transactionStatus ?? json?.status ?? "").trim()

  if (!status) {
    return NextResponse.json({ ok: false, message: "No status from WayForPay", debug: json ?? null }, { status: 200 })
  }

  // Оплачено
  if (status === "Approved") {
    const deviceHash = getDeviceHash()

    try {
      const sb = supabaseAdmin()

      const { data: existing } = await sb
        .from("access_grants")
        .select("id, paid_until")
        .eq("device_hash", deviceHash)
        .maybeSingle()

      const now = new Date()
      const base = existing?.paid_until ? new Date(existing.paid_until as any) : now
      const start = base.getTime() > now.getTime() ? base : now

      const newUntil = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)

      if (existing?.id) {
        await sb
          .from("access_grants")
          .update({ paid_until: newUntil.toISOString(), trial_questions_left: 0 })
          .eq("id", existing.id)
      } else {
        await sb
          .from("access_grants")
          .insert([{ device_hash: deviceHash, trial_questions_left: 0, paid_until: newUntil.toISOString() }])
      }

      return NextResponse.json(
        { ok: true, status, paid_until: newUntil.toISOString(), device_hash: deviceHash },
        { status: 200 }
      )
    } catch (e: any) {
      return NextResponse.json(
        { ok: true, status, message: "Approved, but failed to save access_grant", error: String(e?.message || e) },
        { status: 200 }
      )
    }
  }

  return NextResponse.json({ ok: false, status, message: `Статус: ${status}` }, { status: 200 })
}
