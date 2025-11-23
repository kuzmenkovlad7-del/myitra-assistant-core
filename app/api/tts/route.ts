import { type NextRequest, NextResponse } from "next/server"

interface GoogleTTSCredentials {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
  universe_domain: string
}

// Dr. Alexander's Google Cloud TTS credentials
const GOOGLE_TTS_CREDENTIALS: GoogleTTSCredentials = {
  type: "service_account",
  project_id: "strong-maker-471022-s6",
  private_key_id: "dc48898af9911d21c7959fd5b13bb28db7ea1354",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCuFvlHiJgmSpjv\n9stiMzxxidgqxcN2/ralj7zgkkjXXhOgikfeOhBpjvjBeLDgLxNynA7DjoQ8wHbf\ngdrRuCqnrg83NC/FXTLHDRXXLW+megwcNLu3Kl7gR7q8iABBw1FaZxFnjduejnti\nAxL3ZQnAFB9Uw2U9bQBh2TejD225TEJnyqiuecVD9pkAZE8aeN5ZgPnljLMjzkfk\njKSeZMU+2kHdcs4YCQ4ShNG2C7eL7mWsj1RpG9KKnOlkMlaZ8noM++pO4q7mCzc5\nDOUDv9gpCXKG1324KgZug1k3KN9jlyTdGs7r/MFcUHFRNWUOpCMdxkIdPLRMlWJT\nlF7uQabxAgMBAAECggEABbY6wRJV/aGicXMdOrBYKhh9929MKb4TM4zrA0pBahGL\n3s9SqtOoYLJAbqadVQmuX2sH3/ov1AdzjwNFcO6UNbK0DJlhfN4BMb836Xqz6Fgm\nSBGh3BFfkgfAdHmY2o+EPo1VqJpiq4ncuftEVsohnwP6AC+2BWUrZ0p3dRnnPXZZ\nad02aThfaG73awScY5T0rotCIlq5M2z748EoBKHPUKELFunq5EiPiQfSIynO/Gpm\nayNtJ8OH8eQXNEnr5ixa/lo3L3g8w2cA+DnMTrFX1UGsbgoGgbY9/8c4bSEAcjUA\na6U8NxTb9jqjDcnIeXmG6XW3Qhhu385EwqvGQSg4HQKBgQDm2AQfF/RKkjbKworS\nXZfaBVgsMqR7pkqnOX54Fr/Y0mkdY6qjh4rG+OBo2GHLn+VRLSbWVSmpy962cZWo\nXHdi9n4rMSXApxLoYdb9pNeYrNO6uxxC+DM7R2tTI8J6LtyuTEsw9s/AOYkP/Skf\nUswHgqexqpZ3pAnZS3Ova7njRQKBgQDBD6gGwOa7krhpfgwJnhd7ver+Bar8VN1E\n2QFnCpETx2NGtZtOKwD2k+Zn+Y8dv/+TSaSj6kERgjqDBvSj/XU8kNN2Wdc22nwW\nnnLTo2fusaKpZP3OWdgNUMv7cC7RKjK5ZecO0JZGRF7f+6N4zs2707cbxAf0qR+S\nzTDbNii5vQKBgQCWe0bkhhcH7ZyuPHeGfuCYjVdXKIQ03shXjpE084+IZlGDiQ8Z\nnygGYQLZFgVaWheA/XAN1GJef7nlMNIgeHaTGqBQw68akU8wEWe23Rh2PGOhnIvl\n1CqBgCMkhXEneRj+vlldx+bSJi+FLsD53F2In9F1bgC8aUDKV/dH6W+6CQKBgQCy\nA4quN35JJH9QHj5hO9lxauvcMEO6CVJBYkrtxQuCjk4W6+t5ByQLONKxuqXhC6FQ\nIQ5jaeN3jnn/SRGYiGNqZivlq+9Kj+jtPkqopLp3mGlhAlMYyzTxCjgb7xPsH5nH\n45NK0MBPqElHBBN2mFGRSCVFv9qKGMuZJARRjL2+jQKBgQDVV50qRixSs2PkfbQa\n+NsCz16EHBFTz8mGkPtNZtWB2eZUK3toxmDw+iZormjPN8IxdgVjUmH4nA+PVMg9\nzcg+vXDBQlkD+lr3LDxi6vWfThbC1aY8W34qCjPBFYYPGH8W8sWUMSi388I5P3cI\ntI/Wlzv7csphuz620VfkkJlHjw==\n-----END PRIVATE KEY-----\n",
  client_email: "tts-service-1@strong-maker-471022-s6.iam.gserviceaccount.com",
  client_id: "103107984061473463379",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/tts-service-1%40strong-maker-471022-s6.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
}

// JWT token generation for Google Cloud authentication
async function generateJWT(): Promise<string> {
  try {
    // Create JWT header
    const header = {
      alg: "RS256",
      typ: "JWT",
    }

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: GOOGLE_TTS_CREDENTIALS.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: GOOGLE_TTS_CREDENTIALS.token_uri,
      exp: now + 3600, // 1 hour
      iat: now,
    }

    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

    // Create signature data
    const signatureData = `${encodedHeader}.${encodedPayload}`

    // Import private key for signing
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(GOOGLE_TTS_CREDENTIALS.private_key),
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    )

    // Sign the JWT
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signatureData))

    // Encode signature
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")

    return `${signatureData}.${encodedSignature}`
  } catch (error) {
    console.error("Error generating JWT:", error)
    throw error
  }
}

// Convert PEM private key to ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "")

  const binaryString = atob(pemContents)
  const bytes = new Uint8Array(binaryString.length)

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes.buffer
}

// Get access token from Google OAuth2
async function getAccessToken(): Promise<string> {
  try {
    const jwt = await generateJWT()

    const response = await fetch(GOOGLE_TTS_CREDENTIALS.token_uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token request failed: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()
    return tokenData.access_token
  } catch (error) {
    console.error("Error getting access token:", error)
    throw error
  }
}

// POST endpoint for Dr. Alexander's Ukrainian TTS
export async function POST(request: NextRequest) {
  try {
    console.log("🎤 Dr. Alexander's TTS API endpoint called")

    // Parse request body
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Text is required",
          details: "Please provide valid text for speech synthesis",
        },
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    console.log(`🎤 Generating Dr. Alexander's voice for: "${text.substring(0, 50)}..."`)

    // Get access token
    const accessToken = await getAccessToken()

    // Prepare TTS request with Dr. Alexander's specific voice
    const ttsRequest = {
      input: { text: text.trim() },
      voice: {
        languageCode: "uk-UA",
        name: "uk-UA-Chirp3-HD-Schedar", // Dr. Alexander's correct Ukrainian male voice
        ssmlGender: "MALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.85, // Slightly slower for authoritative voice
        volumeGainDb: 0.0,
      },
    }

    console.log("🎤 Using Dr. Alexander's voice: uk-UA-Chirp3-HD-Schedar")

    // Call Google Cloud TTS API
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ttsRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Google TTS API error:`, errorText)

      return NextResponse.json(
        {
          success: false,
          error: "Google TTS API error",
          details: `API returned ${response.status}: ${errorText}`,
        },
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const result = await response.json()

    if (!result.audioContent) {
      return NextResponse.json(
        {
          success: false,
          error: "No audio content received",
          details: "Google TTS API did not return audio content",
        },
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    console.log("✅ Successfully generated Dr. Alexander's Ukrainian TTS")

    // Return successful response with audio data
    return NextResponse.json(
      {
        success: true,
        audioContent: result.audioContent,
        voice: "uk-UA-Chirp3-HD-Schedar",
        language: "uk-UA",
        text: text.trim(),
        character: "Dr. Alexander",
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error: any) {
    console.error("❌ Dr. Alexander's TTS server error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
      },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// GET endpoint for health check
export async function GET() {
  try {
    return NextResponse.json(
      {
        success: true,
        message: "Dr. Alexander's TTS API is running",
        voice: "uk-UA-Chirp3-HD-Schedar",
        language: "Ukrainian",
        character: "Dr. Alexander",
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Health check failed",
        details: error.message,
      },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
