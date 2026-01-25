import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function extractOrderReference(req: NextRequest, body?: any) {
  const fromQuery = String(req.nextUrl.searchParams.get("orderReference") || "").trim()
  const fromBody = String(body?.orderReference || body?.order_reference || "").trim()
  return fromQuery || fromBody
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || ""
  let body: any = null

  if (contentType.includes("application/json")) {
    body = await req.json().catch(() => null)
  } else {
    const text = await req.text().catch(() => "")
    if (text) {
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    }
  }

  const orderReference = extractOrderReference(req, body)
  const url = new URL("/payment/result", req.nextUrl.origin)
  if (orderReference) url.searchParams.set("orderReference", orderReference)

  return NextResponse.redirect(url, { status: 303 })
}

export async function GET(req: NextRequest) {
  const orderReference = extractOrderReference(req)
  const url = new URL("/payment/result", req.nextUrl.origin)
  if (orderReference) url.searchParams.set("orderReference", orderReference)

  return NextResponse.redirect(url, { status: 303 })
}
