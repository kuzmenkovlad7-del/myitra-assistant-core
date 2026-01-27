import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function getOrigin(req: Request) {
  const url = new URL(req.url)
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host
  return `${proto}://${host}`
}

function safeNextPath(v: string | null) {
  const s = String(v || "").trim()
  if (!s) return "/login"
  if (s.startsWith("/")) return s
  return "/login"
}

function baseDomainFromHost(host: string) {
  const h = String(host || "").split(":")[0].trim()
  const parts = h.split(".").filter(Boolean)
  if (parts.length < 2) return null
  return parts.slice(-2).join(".")
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = getOrigin(req)

  const next = safeNextPath(url.searchParams.get("next"))
  const res = NextResponse.redirect(new URL(next, origin), { status: 302 })

  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"')
  res.headers.set("cache-control", "no-store")

  const all = cookies().getAll()
  const host = url.host || ""
  const baseDomain = baseDomainFromHost(host)

  for (const c of all) {
    res.cookies.set(c.name, "", { path: "/", maxAge: 0 })
    if (baseDomain) res.cookies.set(c.name, "", { path: "/", maxAge: 0, domain: `.${baseDomain}` })
    if (baseDomain) res.cookies.set(c.name, "", { path: "/", maxAge: 0, domain: baseDomain })
    // legacy for turbotaai.com, чтобы не зависеть от proxy host
    res.cookies.set(c.name, "", { path: "/", maxAge: 0, domain: ".turbotaai.com" })
    res.cookies.set(c.name, "", { path: "/", maxAge: 0, domain: "turbotaai.com" })
  }

  return res
}
