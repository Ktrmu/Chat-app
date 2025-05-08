"use server"

import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"

export async function analyzeData(data: any): Promise<string> {
  try {
    // Function to truncate data for analysis
    const truncateData = (data: any): any => {
      if (Array.isArray(data)) {
        // If it's an array, limit to first 10 items
        return data.slice(0, 10)
      } else if (typeof data === "object" && data !== null) {
        // If it's an object, process each key
        const result: Record<string, any> = {}
        const keys = Object.keys(data).slice(0, 20) // Limit to 20 keys

        for (const key of keys) {
          if (typeof data[key] === "string" && data[key].length > 500) {
            // Truncate long strings
            result[key] = data[key].substring(0, 500) + "... (truncated)"
          } else if (Array.isArray(data[key])) {
            // Limit arrays
            result[key] = data[key].slice(0, 5)
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

    // Get data statistics for better analysis
    const stats = getDataStatistics(data)

    // Determine if this is health data from DHIS2
    const isHealthData = detectHealthData(data)

    // Add health data context if applicable
    const healthContext = isHealthData
      ? `This appears to be health data, possibly from DHIS2. 
         When analyzing, consider health indicators, trends, and potential public health implications.
         Focus on identifying patterns that might be relevant for health policy or intervention planning.`
      : ""

    // Convert truncated data to a string representation for the LLM
    const dataString = JSON.stringify(truncatedData, null, 2)

    // Generate a summary using Groq
    const { text } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      prompt: `
        You are a data analyst assistant specializing in health data. Analyze the following data sample and provide a concise summary.
        Focus on key insights, patterns, and notable statistics. Keep your response under 300 words.
        
        This is a sample of the full dataset. Here are some statistics about the complete dataset:
        ${stats}
        
        ${healthContext}
        
        DATA SAMPLE:
        ${dataString}
        
        SUMMARY:
      `,
      maxTokens: 500,
    })

    return text.trim()
  } catch (error) {
    console.error("Error analyzing data:", error)
    return "Failed to analyze the data. The dataset might be too large. Try uploading a smaller file or a sample of your data."
  }
}

// Function to get statistics about the data
function getDataStatistics(data: any): string {
  try {
    let stats = ""

    if (Array.isArray(data)) {
      stats += `- Total number of records: ${data.length}\n`

      if (data.length > 0 && typeof data[0] === "object") {
        stats += `- Fields per record: ${Object.keys(data[0]).length}\n`
        stats += `- Field names: ${Object.keys(data[0]).join(", ")}\n`

        // Sample some values for numeric fields to get min/max/avg
        const numericFields = Object.keys(data[0]).filter((key) => !isNaN(Number(data[0][key])) && data[0][key] !== "")

        if (numericFields.length > 0) {
          stats += "- Numeric field statistics:\n"

          numericFields.forEach((field) => {
            const values = data.map((item) => Number(item[field])).filter((val) => !isNaN(val))

            if (values.length > 0) {
              const min = Math.min(...values)
              const max = Math.max(...values)
              const avg = values.reduce((sum, val) => sum + val, 0) / values.length

              stats += `  - ${field}: min=${min}, max=${max}, avg=${avg.toFixed(2)}\n`
            }
          })
        }
      }
    } else if (typeof data === "object" && data !== null) {
      stats += `- Total number of keys: ${Object.keys(data).length}\n`
      stats += `- Key names: ${Object.keys(data).join(", ")}\n`
    }

    return stats
  } catch (error) {
    return "Could not generate statistics for this dataset."
  }
}

// Function to detect if the data is likely health data from DHIS2
function detectHealthData(data: any): boolean {
  if (!data) return false

  // Check if it's an array of objects
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    // Look for common DHIS2 fields
    const firstItem = data[0]
    const keys = Object.keys(firstItem)

    const dhis2Fields = [
      "id",
      "name",
      "description",
      "numerator",
      "denominator",
      "dataElement",
      "period",
      "orgUnit",
      "categoryOptionCombo",
      "value",
      "storedBy",
      "created",
      "lastUpdated",
    ]

    // Check if any DHIS2 fields are present
    const matchingFields = dhis2Fields.filter((field) => keys.includes(field))

    // If we have at least 2 matching fields, it's likely DHIS2 data
    return matchingFields.length >= 2
  }

  // Check if it's a DHIS2 response object
  if (typeof data === "object" && data !== null) {
    return "dataValues" in data || "indicators" in data || "dataElements" in data
  }

  return false
}
