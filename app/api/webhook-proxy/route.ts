import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Get the webhook URL, payload, and method from the request
    const { webhookUrl, payload, method = "GET" } = await request.json()

    // Validate webhook URL
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 })
    }

    // Log what we're sending to help debug
    console.log("Sending to webhook:", { method, webhookUrl, payload })

    let response

    if (method.toUpperCase() === "GET") {
      // For GET requests, convert payload to query parameters
      const queryParams = new URLSearchParams()

      // Add each payload property as a query parameter
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value))
        }
      })

      // Append query parameters to URL
      const urlWithParams = `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}${queryParams.toString()}`

      // Send GET request
      response = await fetch(urlWithParams, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })
    } else {
      // Send POST request as before
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    }

    // If the webhook request failed, return the error
    if (!response.ok) {
      // Read the response body as text first
      const errorText = await response.text()

      // Try to parse as JSON if it looks like JSON
      let errorDetails
      try {
        if (errorText.trim().startsWith("{") || errorText.trim().startsWith("[")) {
          errorDetails = JSON.parse(errorText)
        } else {
          errorDetails = errorText
        }
      } catch (e) {
        errorDetails = errorText
      }

      console.error(`Webhook error (${response.status}):`, errorDetails)

      return NextResponse.json(
        {
          error: "Webhook request failed",
          status: response.status,
          details: errorDetails,
        },
        { status: 502 },
      )
    }

    // Read the response body as text first
    const responseText = await response.text()

    // Try to parse as JSON if it looks like JSON
    let responseData
    try {
      if (responseText.trim().startsWith("{") || responseText.trim().startsWith("[")) {
        responseData = JSON.parse(responseText)
      } else {
        responseData = responseText
      }
    } catch (e) {
      responseData = responseText
    }

    // Return success response with the webhook response data
    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error) {
    console.error("Webhook proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
