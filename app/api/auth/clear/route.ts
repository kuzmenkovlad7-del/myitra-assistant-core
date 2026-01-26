import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function delCookie(res: NextResponse, name: string) {
  // host-only
  res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" })
  // cross-subdomain (если вдруг выставлялось с domain)
  res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax", domain: ".turbotaai.com" })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = url.searchParams.get("next") || "/"

  const res = NextResponse.redirect(new URL(next, url.origin))

  // наши cookies
  delCookie(res, "ta_last_order")
  delCookie(res, "ta_device_hash")

  // supabase cookies (sb-*)
  const all = cookies().getAll()
  for (const c of all) {
    if (c.name.startsWith("sb-")) delCookie(res, c.name)
  }

  return res
}
