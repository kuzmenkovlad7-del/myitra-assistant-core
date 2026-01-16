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

  // 1) если уже есть grant по user_id -> ок
  const { data: byUser } = await sb
    .from("access_grants")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUser) return byUser;

  // 2) если есть guest grant по device_hash -> прикрепляем к юзеру
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

  // 3) иначе создаем новый grant под user_id
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
  const name = String(body?.name ?? "").trim();

  if (!email || !password) {
    return json({ ok: false, error: "Email and password are required" }, 400);
  }

  const { data: signUpData, error: signUpError } = await sb.auth.signUp({
    email,
    password,
    options: { data: name ? { name } : undefined },
  });

  if (signUpError || !signUpData?.user) {
    return json({ ok: false, error: signUpError?.message || "Sign up failed" }, 400);
  }

  // Если Supabase требует подтверждение email, session будет null
  // Делаем авто-подтверждение через service_role и логиним сразу
  if (!signUpData.session) {
    const admin = supabaseAdminOrNull();
    if (!admin) {
      return json(
        {
          ok: false,
          error:
            "Email confirmation is enabled in Supabase. Add SUPABASE_SERVICE_ROLE_KEY to env OR disable email confirmations.",
        },
        400
      );
    }

    try {
      await admin.auth.admin.updateUserById(signUpData.user.id, {
        email_confirm: true,
        user_metadata: name ? { name } : undefined,
      } as any);
    } catch (e: any) {
      // если не получилось подтвердить, дальше signIn упадет с Email not confirmed
    }

    const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({ email, password });
    if (signInError || !signInData?.session) {
      return json(
        {
          ok: false,
          error: signInError?.message || "Auto login failed after sign up",
        },
        400
      );
    }

    await ensureAccessGrant(sb, signInData.user.id);

    return json({ ok: true, user: signInData.user });
  }

  // session уже есть -> просто привязываем grant
  await ensureAccessGrant(sb, signUpData.user.id);

  return json({ ok: true, user: signUpData.user });
}
