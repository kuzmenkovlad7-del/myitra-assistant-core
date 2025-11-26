// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server"

const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const CONTACT_RECIPIENT_EMAIL = process.env.CONTACT_RECIPIENT_EMAIL

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const name = (body.name ?? "").toString().trim()
    const email = (body.email ?? "").toString().trim()
    const company = (body.company ?? "").toString().trim()
    const message = (body.message ?? "").toString().trim()

    if (!email || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY || !CONTACT_RECIPIENT_EMAIL) {
      console.error("Mailgun env vars are not set")
      return NextResponse.json(
        { ok: false, error: "Email service is not configured" },
        { status: 500 }
      )
    }

    const text = [
      `Name: ${name || "—"}`,
      `Company: ${company || "—"}`,
      `Email: ${email}`,
      "",
      "Message:",
      message,
    ].join("\n")

    const formData = new URLSearchParams()
    formData.append("from", `TurbotaAI Website <no-reply@${MAILGUN_DOMAIN}>`)
    formData.append("to", CONTACT_RECIPIENT_EMAIL)
    formData.append("subject", `New contact form message from ${name || email}`)
    formData.append("text", text)

    const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error("Mailgun error:", res.status, errorText)
      return NextResponse.json(
        { ok: false, error: "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
