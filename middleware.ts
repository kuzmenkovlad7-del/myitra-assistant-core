import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname

  if (
    p === "/%23assistant" ||
    p === "/%23assistant/" ||
    p === "/%2523assistant" ||
    p === "/%2523assistant/"
  ) {
    const url = req.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    url.hash = "assistant"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/%23assistant", "/%23assistant/", "/%2523assistant", "/%2523assistant/"],
}
