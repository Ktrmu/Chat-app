"use server"

import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"

// Cache for storing recent responses to avoid redundant API calls
const responseCache = new Map<string, { text: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

export async function generateResponse(question: string, data: any): Promise<string> {
  try {
    // Create a cache key based on the question and a simplified version of the data
    const cacheKey = `${question}-${JSON.stringify(data).substring(0, 100)}`

    // Check if we have a cached response
    const cachedResponse = responseCache.get(cacheKey)
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      console.log("Using cached response for:", question)
      return cachedResponse.text
    }

    // Function to truncate data for analysis
    const truncateData = (data: any): any => {
      if (Array.isArray(data)) {
        // If it's an array, limit to first 5 items (reduced from 20)
        return data.slice(0, 5)
      } else if (typeof data === "object" && data !== null) {
        // If it's an object, process each key
        const result: Record<string, any> = {}
        const keys = Object.keys(data).slice(0, 10) // Limit to 10 keys (reduced from 20)

        for (const key of keys) {
          if (typeof data[key] === "string" && data[key].length > 200) {
            // Truncate long strings to 200 chars (reduced from 500)
            result[key] = data[key].substring(0, 200) + "... (truncated)"
          } else if (Array.isArray(data[key])) {
            // Limit arrays to 3 items (reduced from 5)
            result[key] = data[key].slice(0, 3)
          } else {
            result[key] = data[key]
          }
        }

        return result
      }

      return data
    }

    // Truncate data to avoid token limits
    const truncatedData = truncateData(data)

    // Get data statistics for better context
    const stats = getEnhancedDataStatistics(data)

    // Determine if this is health data
    const isHealthData = detectHealthData(data)

    // Add health data context if applicable - shortened for token efficiency
    const healthContext = isHealthData
      ? `This is health data. Consider health indicators and public health implications.`
      : `Use professional formatting with sections and bullet points.`

    // Convert truncated data to a string representation for the LLM
    // Further limit the size of the data string to reduce token usage
    const dataString =
      JSON.stringify(truncatedData, null, 2).substring(0, 1500) +
      (JSON.stringify(truncatedData, null, 2).length > 1500 ? "... (truncated)" : "")

    // Implement retry logic with exponential backoff
    const maxRetries = 3
    let retryDelay = 1000 // Start with 1 second delay
    let lastError: any = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Generate a response using Groq with reduced max tokens
        const { text } = await generateText({
          model: groq("llama-3.1-8b-instant"),
          prompt: `
            You are a professional data analyst specializing in health data. Answer the following question about the provided data.
            Be concise and use professional language. Format your response with clear sections where appropriate.
            
            IMPORTANT: Your response must include BOTH qualitative insights AND quantitative findings with specific numbers.
            
            Include the following in your response:
            1. Key metrics with exact numbers (percentages, averages, ranges, etc.)
            2. Statistical findings (correlations, distributions, outliers)
            3. Numerical comparisons between different categories or groups
            4. Trends and patterns expressed with specific values
            5. Quantitative conclusions with supporting numbers
            
            This is a sample of the full dataset. Here are some key statistics:
            ${stats}
            
            ${healthContext}
            
            DATA SAMPLE:
            ${dataString}
            
            QUESTION:
            ${question}
            
            ANSWER (include both qualitative insights AND specific numerical findings):
          `,
          maxTokens: 600, // Increased from 500 to allow for more detailed analysis
        })

        // Cache the successful response
        responseCache.set(cacheKey, { text: text.trim(), timestamp: Date.now() })

        return text.trim()
      } catch (error: any) {
        lastError = error
        console.error(`Attempt ${attempt + 1} failed:`, error.message || error)

        // Check if it's a rate limit error
        if (error.message && error.message.includes("Rate limit reached")) {
          // Extract the suggested wait time if available
          const waitTimeMatch = error.message.match(/Please try again in (\d+\.\d+)s/)
          const waitTime = waitTimeMatch ? Number.parseFloat(waitTimeMatch[1]) * 1000 : retryDelay

          console.log(`Rate limit hit. Waiting for ${waitTime}ms before retry`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        } else {
          // For other errors, use exponential backoff
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          retryDelay *= 2 // Exponential backoff
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message || lastError}`)
  } catch (error) {
    console.error("Error generating response:", error)
    return "I'm sorry, I encountered a rate limit error. Please try again with a more specific question or wait a moment before asking another question."
  }
}

// Function to get enhanced statistics about the data
function getEnhancedDataStatistics(data: any): string {
  try {
    let stats = ""

    if (Array.isArray(data)) {
      stats += `- Total Records: ${data.length}\n`

      if (data.length > 0 && typeof data[0] === "object") {
        const fields = Object.keys(data[0])
        stats += `- Fields: ${fields.length}\n`

        // Include key field names
        if (fields.length > 0) {
          stats += `- Key fields: ${fields.slice(0, 7).join(", ")}\n`
        }

        // Find and analyze numeric fields
        const numericFields = fields.filter((key) => !isNaN(Number(data[0][key])) && data[0][key] !== "")

        if (numericFields.length > 0) {
          stats += "- Numeric field statistics:\n"

          numericFields.forEach((field) => {
            const values = data.map((item) => Number(item[field])).filter((val) => !isNaN(val))

            if (values.length > 0) {
              const min = Math.min(...values)
              const max = Math.max(...values)
              const sum = values.reduce((acc, val) => acc + val, 0)
              const avg = sum / values.length
              const median = calculateMedian(values)

              // Calculate standard deviation
              const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length
              const stdDev = Math.sqrt(variance)

              // Count values above and below average
              const aboveAvg = values.filter((val) => val > avg).length
              const belowAvg = values.filter((val) => val < avg).length

              stats += `  - ${field}:\n`
              stats += `    - Range: ${min.toFixed(2)} to ${max.toFixed(2)}\n`
              stats += `    - Average: ${avg.toFixed(2)}\n`
              stats += `    - Median: ${median.toFixed(2)}\n`
              stats += `    - Standard Deviation: ${stdDev.toFixed(2)}\n`
              stats += `    - Distribution: ${aboveAvg} values above average, ${belowAvg} below average\n`
            }
          })
        }

        // Find and analyze categorical fields
        const categoricalFields = fields
          .filter((field) => typeof data[0][field] === "string" && !numericFields.includes(field))
          .slice(0, 3)

        if (categoricalFields.length > 0) {
          stats += "- Categorical field distributions:\n"

          categoricalFields.forEach((field) => {
            const valueCount = new Map<string, number>()

            data.forEach((item) => {
              const value = String(item[field])
              if (value) {
                valueCount.set(value, (valueCount.get(value) || 0) + 1)
              }
            })

            // Get top categories
            const topCategories = Array.from(valueCount.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)

            if (topCategories.length > 0) {
              stats += `  - ${field} (top ${topCategories.length}):\n`
              topCategories.forEach(([category, count]) => {
                const percentage = ((count / data.length) * 100).toFixed(1)
                stats += `    - ${category}: ${count} (${percentage}%)\n`
              })
            }
          })
        }

        // Try to identify relationships between fields
        if (numericFields.length >= 2) {
          const field1 = numericFields[0]
          const field2 = numericFields[1]

          const validPairs = data
            .map((item) => [Number(item[field1]), Number(item[field2])])
            .filter((pair) => !isNaN(pair[0]) && !isNaN(pair[1]))

          if (validPairs.length > 5) {
            const correlation = calculateCorrelation(validPairs)
            stats += `- Relationship: Correlation between ${field1} and ${field2} is ${correlation.toFixed(2)}\n`
          }
        }
      }
    } else if (typeof data === "object" && data !== null) {
      stats += `- Keys: ${Object.keys(data).length}\n`
      // Include key names
      const keyNames = Object.keys(data).slice(0, 7)
      if (keyNames.length > 0) {
        stats += `- Key names: ${keyNames.join(", ")}\n`
      }
    }

    return stats
  } catch (error) {
    return "Basic dataset statistics unavailable."
  }
}

// Helper function to calculate median
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  } else {
    return sorted[middle]
  }
}

// Helper function to calculate correlation coefficient
function calculateCorrelation(pairs: number[][]): number {
  try {
    const n = pairs.length
    if (n <= 1) return 0

    // Calculate means
    let sumX = 0,
      sumY = 0
    for (const [x, y] of pairs) {
      sumX += x
      sumY += y
    }
    const meanX = sumX / n
    const meanY = sumY / n

    // Calculate correlation coefficient
    let numerator = 0
    let denomX = 0
    let denomY = 0

    for (const [x, y] of pairs) {
      const diffX = x - meanX
      const diffY = y - meanY
      numerator += diffX * diffY
      denomX += diffX * diffX
      denomY += diffY * diffY
    }

    if (denomX === 0 || denomY === 0) return 0
    return numerator / Math.sqrt(denomX * denomY)
  } catch (error) {
    return 0
  }
}

// Function to detect if the data is likely health data - unchanged
function detectHealthData(data: any): boolean {
  if (!data) return false

  // Check if it's an array of objects
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    // Look for common health-related fields
    const firstItem = data[0]
    const keys = Object.keys(firstItem)

    const healthFields = [
      "patient",
      "diagnosis",
      "treatment",
      "medication",
      "disease",
      "health",
      "medical",
      "clinical",
      "hospital",
      "doctor",
      "nurse",
      "symptom",
      "indicator",
    ]

    // Check if any health-related terms are present in the keys
    return keys.some((key) => healthFields.some((term) => key.toLowerCase().includes(term.toLowerCase())))
  }

  return false
}
