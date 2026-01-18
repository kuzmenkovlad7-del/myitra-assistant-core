import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingStatus = "paid" | "failed" | "processing" | "not_found";

function pickBestStatus(statuses: string[]): BillingStatus {
  const s = statuses.map((x) => String(x || "").toLowerCase());
  if (s.includes("paid")) return "paid";
  if (s.includes("processing")) return "processing";
  if (s.length === 0) return "not_found";
  return "failed";
}

function safeSupabaseHost() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const urlObj = new URL(req.url);
  const orderReference = urlObj.searchParams.get("orderReference")?.trim() || "";
  const debug = urlObj.searchParams.get("debug") === "1";

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 });
  }

  console.info("[billing][status] request", {
    orderReference,
    supabaseHost: safeSupabaseHost(),
  });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_orders")
    .select("status, updated_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[billing][status] db error", { orderReference, error });
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  const statuses = (data || []).map((r: any) => String(r.status || ""));
  const best = pickBestStatus(statuses);

  console.info("[billing][status] result", {
    orderReference,
    best,
    statuses,
    rows: (data || []).length,
  });

  if (debug) {
    return NextResponse.json({
      ok: true,
      orderReference,
      status: best,
      statuses,
      supabaseHost: safeSupabaseHost(),
      rows: (data || []).length,
    });
  }

  return NextResponse.json({
    ok: true,
    orderReference,
    status: best,
  });
}
