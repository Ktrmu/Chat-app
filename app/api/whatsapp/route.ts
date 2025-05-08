import { type NextRequest, NextResponse } from "next/server"
import { processWhatsAppMessage } from "@/lib/twilio-service"

// In-memory store for user sessions (would use a database in production)
const userSessions: Record<string, any> = {}

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming webhook from Twilio
    const formData = await request.formData()

    const body = formData.get("Body") as string
    const from = formData.get("From") as string
    const to = formData.get("To") as string
    const profileName = formData.get("ProfileName") as string

    if (!body || !from) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the user's session data if it exists
    const sessionData = userSessions[from] || null

    // Process the message
    const response = await processWhatsAppMessage({ body, from, to, profileName }, sessionData)

    // Format response for Twilio
    const twilioResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${response.message}</Message>
</Response>`

    return new NextResponse(twilioResponse, {
      headers: {
        "Content-Type": "text/xml",
      },
    })
  } catch (error) {
    console.error("Error handling WhatsApp webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Endpoint to update a user's session data when they upload data on the web
export async function PUT(request: NextRequest) {
  try {
    const { phoneNumber, data } = await request.json()

    if (!phoneNumber || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Store the data in the user's session
    userSessions[phoneNumber] = data

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
