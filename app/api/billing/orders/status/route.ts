import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function env(name: string) {
  return String(process.env[name] || "").trim()
}
function mustEnv(name: string) {
  const v = env(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function noStoreHeaders() {
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

async function handle(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const orderReference =
    (sp.get("orderReference") || sp.get("order_reference") || sp.get("order") || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400, headers: noStoreHeaders() })
  }

  try {
    const admin = sbAdmin()
    const { data, error } = await admin
      .from("billing_orders")
      .select("order_reference,status,plan_id,amount,currency,updated_at,raw")
      .eq("order_reference", orderReference)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: noStoreHeaders() })
    }

    if (!data) {
      return NextResponse.json(
        { ok: true, found: false, orderReference, status: "not_found" },
        { status: 200, headers: noStoreHeaders() }
      )
    }

    const status = normalizeStatus((data as any).status)
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
        updatedAt: (data as any).updated_at ?? null,
      },
      { status: 200, headers: noStoreHeaders() }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "status failed", details: String(e?.message || e) },
      { status: 500, headers: noStoreHeaders() }
    )
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
