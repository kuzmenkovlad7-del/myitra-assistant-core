import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    // Clean up the OpenAI API key (remove any spaces)
    const apiKey = process.env.OPENAI_API_KEY?.replace(/\s+/g, "")

    if (!apiKey) {
      console.error("OpenAI API key is missing")
      return NextResponse.json({
        response: "I'm sorry, I'm having trouble connecting to my knowledge base. Please try again later.",
      })
    }

    try {
      // Create OpenAI client with API key
      const openaiClient = openai({
        apiKey: apiKey,
      })

      // Generate response using AI SDK
      const { text: aiResponse } = await generateText({
        model: openaiClient("gpt-4o"),
        prompt: text,
        system: `You are a friendly and attentive AI Assistant that plays the role of a professional psychologist. Your task is to answer any user's questions, including mundane, personal, emotional, philosophical, or even superficial ones, with respect, empathy, and a deep understanding of psychology.

You can use any available information (including general knowledge, psychological theories, research, behavioral models, real-life examples, analogies, etc.) to provide a detailed, meaningful, and supportive answer whenever needed.

Your answers should be:

Empathetic: show understanding and support, even if the question seems trivial or joking.

Structured: give logical, reasoned, and in-depth answers.

Psychologically sound: if necessary, use well-known models (e.g., cognitive-behavioral approach, attachment theory, Maslow's pyramid, etc.).

Friendly and open to dialog: encourage the user to ask additional questions or share more.

Always respond as if you were talking to a real person in a psychologist's office.

Be sure to respond in the language of the request message`,
        maxTokens: 150,
      })

      return NextResponse.json({ response: aiResponse })
    } catch (aiError) {
      console.error("Error generating AI response:", aiError)
      return NextResponse.json({
        response: "I'm here to listen and support you. Could you please share more about what's on your mind?",
      })
    }
  } catch (error) {
    console.error("Error processing speech:", error)
    return NextResponse.json({
      response: "I'm here to help. Please feel free to share what's on your mind.",
    })
  }
}
