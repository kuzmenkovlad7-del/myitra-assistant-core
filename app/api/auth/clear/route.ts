import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function routeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const cookieStore = cookies()
  const pendingCookies: any[] = []

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet)
      },
    },
  })

  const json = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status })
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, json }
}

export async function POST() {
  const { sb, json } = routeSupabase()

  try {
    await sb.auth.signOut()
  } catch {}

  const res = json({ ok: true })

  // чистим кастомные куки если есть
  res.cookies.set("turbota_at", "", { path: "/", maxAge: 0 })
  return res
}
