import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderReference = searchParams.get("orderReference") || "";

    if (!orderReference) {
      return NextResponse.json(
        { ok: false, error: "missing_orderReference" },
        { status: 400 }
      );
    }

    const sb = getAdminClient();

    const { data, error } = await sb
      .from("billing_orders")
      .select("order_reference,status,amount,currency,created_at,updated_at,raw")
      .eq("order_reference", orderReference)
      .maybeSingle();

    if (error) {
      console.error("[billing] status db error", error);
      return NextResponse.json(
        { ok: false, error: "db_error", details: String(error.message || error) },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 }
      );
    }

    console.log("[billing] status ok", {
      orderReference: data.order_reference,
      status: data.status,
    });

    return NextResponse.json({
      ok: true,
      orderReference: data.order_reference,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      created_at: data.created_at,
      updated_at: data.updated_at,
      raw: data.raw,
    });
  } catch (e: any) {
    console.error("[billing] status fatal", e);
    return NextResponse.json(
      { ok: false, error: "server_error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
