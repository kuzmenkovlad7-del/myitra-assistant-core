import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json()
    const userMessage = requestData.query || ""
    const userLanguage = requestData.language || "en"
    const userEmail = requestData.email || "user@example.com" // Default email if not provided

    // Forward the request to the n8n webhook using GET
    const webhookUrl = "https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59"

    // Create URL with query parameters for GET request
    const url = new URL(webhookUrl)

    // Add body parameters - only include body structure
    url.searchParams.append("body[query]", userMessage)
    url.searchParams.append("body[language]", userLanguage)
    url.searchParams.append("body[user]", userEmail)

    console.log("Proxying GET request to:", url.toString())

    // Send GET request
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    console.log("GET response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Webhook error:", errorText)
      return NextResponse.json(
        { error: `Webhook returned ${response.status}: ${errorText}` },
        { status: response.status },
      )
    }

    // Try to parse the response
    let data

    try {
      const responseText = await response.text()
      console.log("Raw response:", responseText)

      // Try to parse as JSON
      try {
        data = JSON.parse(responseText)
      } catch {
        // If not JSON, wrap in an object
        data = { response: responseText }
      }
    } catch (error) {
      console.error("Error reading response:", error)
      data = { error: "Failed to read response" }
    }

    console.log("Processed response data:", data)

    return NextResponse.json(data)
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
