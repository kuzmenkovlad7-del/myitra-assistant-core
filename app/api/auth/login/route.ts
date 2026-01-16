import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function routeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = cookies();
  const pendingCookies: any[] = [];

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const json = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status });
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  };

  return { sb, json };
}

function supabaseAdminOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getDeviceHashFromCookies(): string | null {
  try {
    return cookies().get("turbotaai_device")?.value ?? null;
  } catch {
    return null;
  }
}

async function ensureAccessGrant(sb: any, userId: string) {
  const deviceHash = getDeviceHashFromCookies();
  const trial = Number(process.env.TRIAL_QUESTIONS_LIMIT ?? "5");
  const now = new Date().toISOString();

  const { data: byUser } = await sb
    .from("access_grants")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUser) return byUser;

  if (deviceHash) {
    const { data: byDevice } = await sb
      .from("access_grants")
      .select("*")
      .eq("device_hash", deviceHash)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byDevice?.id) {
      const { data: updated } = await sb
        .from("access_grants")
        .update({ user_id: userId, updated_at: now })
        .eq("id", byDevice.id)
        .select("*")
        .single();
      return updated ?? byDevice;
    }
  }

  const { data: created } = await sb
    .from("access_grants")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      device_hash: deviceHash ?? crypto.randomUUID(),
      trial_questions_left: trial,
      paid_until: null,
      promo_until: null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  return created ?? null;
}

export async function POST(req: Request) {
  const { sb, json } = routeSupabase();

  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return json({ ok: false, error: "Email and password are required" }, 400);
  }

  // пробуем обычный логин
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  // если упало из-за email confirm -> подтверждаем и пробуем еще раз
  if (error && String(error.message || "").toLowerCase().includes("confirm")) {
    const admin = supabaseAdminOrNull();
    if (admin) {
      const { data: userData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = userData?.users?.find((u: any) => String(u.email || "").toLowerCase() === email);
      if (found?.id) {
        try {
          await admin.auth.admin.updateUserById(found.id, { email_confirm: true } as any);
        } catch {}
      }

      const retry = await sb.auth.signInWithPassword({ email, password });
      if (!retry.error && retry.data?.session) {
        await ensureAccessGrant(sb, retry.data.user.id);
        return json({ ok: true, user: retry.data.user });
      }
    }
  }

  if (error || !data?.session) {
    return json({ ok: false, error: error?.message || "Login failed" }, 400);
  }

  await ensureAccessGrant(sb, data.user.id);

  return json({ ok: true, user: data.user });
}
