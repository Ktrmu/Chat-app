"use server"

import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"
import { generateVisualization } from "./generate-visualization"

interface TwilioMessage {
  body: string
  from: string
  to: string
  profileName?: string
}

interface TwilioResponse {
  message: string
  media?: string[]
}

// Function to process incoming WhatsApp messages
export async function processWhatsAppMessage(message: TwilioMessage, sessionData: any): Promise<TwilioResponse> {
  const { body, from } = message
  const command = body.trim().toLowerCase()

  try {
    // Check if this is a data query or visualization request
    if (sessionData) {
      if (command.includes("visualize") || command.includes("chart") || command.includes("graph")) {
        // Generate visualization based on the request
        const visualization = await generateVisualization(body, sessionData)

        // We'd need to generate an image URL for the visualization to send via WhatsApp
        // For now, we'll return a text description
        return {
          message: `📊 *${visualization.title}*\n\n${visualization.description}\n\nTo view the full visualization, please visit the dashboard.`,
        }
      } else {
        // Process as a general data query
        const response = await generateText({
          model: groq("llama-3.1-8b-instant"),
          prompt: `
            You are a professional health data analyst assistant. Answer the following question about the provided data.
            Be concise, accurate, and use professional language. Format your response with clear sections and bullet points where appropriate.
            
            DATA CONTEXT:
            ${JSON.stringify(sessionData).substring(0, 1000)}...
            
            QUESTION:
            ${body}
            
            ANSWER (use professional formatting with sections and bullet points where appropriate):
          `,
          maxTokens: 500,
        })

        return {
          message: response.text,
        }
      }
    } else if (command === "help") {
      // Provide help information
      return {
        message: `*Health Data Analysis Assistant*\n\n*Available Commands:*\n• Upload data via the web dashboard first\n• Ask questions about your data\n• Request visualizations with "visualize [type] of [metric]"\n• Type "help" for this message\n\nVisit the web dashboard for full functionality.`,
      }
    } else {
      // No data available yet
      return {
        message: `Welcome to the Health Data Analysis Assistant! Please upload your data via the web dashboard first, then you can query it via WhatsApp.`,
      }
    }
  } catch (error) {
    console.error("Error processing WhatsApp message:", error)
    return {
      message: "I encountered an error processing your request. Please try again or check the web dashboard.",
    }
  }
}

// Function to send WhatsApp message via Twilio
export async function sendWhatsAppMessage(to: string, message: string, mediaUrls?: string[]): Promise<boolean> {
  try {
    // This would be implemented with actual Twilio API calls
    // For now, we'll just log the message
    console.log(`Sending WhatsApp message to ${to}: ${message}`)
    if (mediaUrls && mediaUrls.length > 0) {
      console.log(`With media: ${mediaUrls.join(", ")}`)
    }
    return true
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    return false
  }
}
