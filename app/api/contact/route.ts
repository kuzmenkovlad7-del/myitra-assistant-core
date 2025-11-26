// app/api/contact/route.ts
import type { NextRequest } from "next"
import { NextResponse } from "next/server"

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "support@turbotaai.com"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, subject, message } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      )
    }

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.error("MAILGUN env is not configured")
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 },
      )
    }

    const formData = new URLSearchParams()
    formData.append("from", `MyITRA Website <no-reply@${MAILGUN_DOMAIN}>`)
    formData.append("to", CONTACT_TO_EMAIL)
    formData.append("subject", `[MyITRA] Новое сообщение с сайта: ${subject}`)
    formData.append(
      "text",
      [
        `Имя: ${name}`,
        `Email: ${email}`,
        "",
        "Сообщение:",
        message,
      ].join("\n"),
    )

    const mgRes = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      },
    )

    if (!mgRes.ok) {
      const text = await mgRes.text()
      console.error("Mailgun error:", text)
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    )
  }
}
