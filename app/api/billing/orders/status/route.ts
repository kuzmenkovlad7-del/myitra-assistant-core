import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderReference = url.searchParams.get("orderReference") || "";
  const debug = url.searchParams.get("debug") === "1";

  if (!orderReference) {
    return NextResponse.json(
      { ok: false, error: "missing_orderReference" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const sb = getSupabaseAdmin();

    const { data, error } = await sb
      .from("billing_orders")
      .select("order_reference,status,raw,created_at,updated_at")
      .eq("order_reference", orderReference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log("[billing][status] supabase error", { orderReference, error });
      return NextResponse.json(
        { ok: false, error: "db_error" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: true, status: "not_found", orderReference },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const resp: any = {
      ok: true,
      status: data.status || "unknown",
      orderReference: data.order_reference,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    if (debug) resp.raw = data.raw;

    return NextResponse.json(resp, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.log("[billing][status] exception", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
