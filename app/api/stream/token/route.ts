import { type NextRequest, NextResponse } from "next/server"
import { StreamChat } from "stream-chat"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const apiKey = process.env.STREAM_API_KEY
    const apiSecret = process.env.STREAM_API_SECRET

    if (!apiKey || !apiSecret) {
      console.error("Stream API credentials not configured")
      return NextResponse.json({ error: "Stream API not configured" }, { status: 500 })
    }

    const serverClient = StreamChat.getInstance(apiKey, apiSecret)
    const token = serverClient.createToken(userId)

    return NextResponse.json({
      token,
      apiKey,
    })
  } catch (error) {
    console.error("Error generating Stream token:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
