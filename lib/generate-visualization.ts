"use server"

import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"
import type { VisualizationConfig } from "@/types/visualization"

// Cache for storing recent visualization configurations
const visualizationCache = new Map<string, { config: VisualizationConfig; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes in milliseconds

export async function generateVisualization(request: string, data: any): Promise<VisualizationConfig> {
  try {
    // Create a cache key based on the request and a simplified version of the data
    const cacheKey = `${request}-${JSON.stringify(data).substring(0, 100)}`

    // Check if we have a cached visualization
    const cachedVisualization = visualizationCache.get(cacheKey)
    if (cachedVisualization && Date.now() - cachedVisualization.timestamp < CACHE_TTL) {
      console.log("Using cached visualization for:", request)
      return cachedVisualization.config
    }

    // Function to extract relevant data for visualization - more aggressive truncation
    const extractVisualizationData = (data: any, request: string): any => {
      // For arrays of objects (most common data format)
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
        // Extract field names that might be relevant to the request
        const fields = Object.keys(data[0])

        // Look for numeric fields (potential values for charts)
        const numericFields = fields.filter((field) => !isNaN(Number(data[0][field])) && data[0][field] !== "")

        // Look for categorical fields (potential labels for charts)
        const categoricalFields = fields.filter(
          (field) => typeof data[0][field] === "string" && !numericFields.includes(field),
        )

        // If we have both numeric and categorical fields, return a sample
        if (numericFields.length > 0 && categoricalFields.length > 0) {
          return data.slice(0, 8) // Return first 8 items (reduced from 15)
        }

        // Otherwise just return a sample of the data
        return data.slice(0, 8)
      }

      return data
    }

    // Determine if this is health data
    const isHealthData = detectHealthData(data)

    // Add health data context if applicable - shortened for token efficiency
    const healthContext = isHealthData ? `This is health data. Choose appropriate chart types for health metrics.` : ``

    // Extract relevant data for visualization
    const visualizationData = extractVisualizationData(data, request)

    // Convert to a string representation for the LLM - limit size
    const dataString =
      JSON.stringify(visualizationData, null, 2).substring(0, 1000) +
      (JSON.stringify(visualizationData, null, 2).length > 1000 ? "... (truncated)" : "")

    // Implement retry logic with exponential backoff
    const maxRetries = 3
    let retryDelay = 1000 // Start with 1 second delay
    let lastError: any = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Generate visualization configuration using Groq with reduced tokens
        const { text } = await generateText({
          model: groq("llama-3.1-8b-instant"),
          prompt: `
            You are a data visualization expert. Create a visualization configuration based on the user's request and the provided data sample.
            Return ONLY a valid JSON object with the following structure:
            {
              "type": "bar" | "line" | "pie" | "donut",
              "title": "Title of the visualization",
              "description": "Brief description of what the visualization shows",
              "data": {
                "labels": ["Label1", "Label2", "Label3"],
                "values": [value1, value2, value3],
                "datasetLabel": "Optional label for the dataset"
              }
            }
            
            IMPORTANT RULES:
            1. DO NOT use ellipses (...) in the JSON - include only complete arrays with actual values
            2. DO NOT use placeholders - use real data from the sample
            3. Limit to 5-7 data points maximum for readability
            4. Include ONLY valid JSON - no comments, no explanations
            5. Make sure all JSON syntax is correct and all quotes are properly escaped
            
            ${healthContext}
            
            DATA SAMPLE:
            ${dataString}
            
            USER REQUEST:
            ${request}
            
            IMPORTANT: Return ONLY the JSON object with no additional text.
          `,
          maxTokens: 800,
        })

        // Improved JSON extraction - find the first { and the last }
        const jsonStartIndex = text.indexOf("{")
        const jsonEndIndex = text.lastIndexOf("}")

        if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex <= jsonStartIndex) {
          console.error("Could not find valid JSON in response:", text)
          throw new Error("Failed to extract valid JSON from LLM response")
        }

        const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1)

        try {
          // Clean up any potential ellipses or invalid JSON syntax before parsing
          const cleanedJsonString = cleanJsonString(jsonString)

          // Try to parse the cleaned JSON
          const config = JSON.parse(cleanedJsonString)

          // Validate the configuration
          if (!config.type || !config.title || !config.data || !config.data.labels || !config.data.values) {
            console.error("Invalid visualization configuration:", config)
            throw new Error("Invalid visualization configuration structure")
          }

          // Ensure labels and values arrays are valid and have the same length
          if (!Array.isArray(config.data.labels) || !Array.isArray(config.data.values)) {
            throw new Error("Labels and values must be arrays")
          }

          if (config.data.labels.length !== config.data.values.length) {
            // Fix the arrays to have the same length
            const minLength = Math.min(config.data.labels.length, config.data.values.length)
            config.data.labels = config.data.labels.slice(0, minLength)
            config.data.values = config.data.values.slice(0, minLength)
          }

          // Cache the successful visualization
          visualizationCache.set(cacheKey, { config, timestamp: Date.now() })

          return config
        } catch (parseError) {
          console.error("JSON parsing error:", parseError, "for string:", jsonString)

          // Try to create a visualization from the data directly if parsing fails
          const extractedConfig = extractVisualizationFromText(text, request, data)
          if (extractedConfig) {
            visualizationCache.set(cacheKey, { config: extractedConfig, timestamp: Date.now() })
            return extractedConfig
          }

          throw new Error("Failed to parse visualization configuration")
        }
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
    console.error("Error generating visualization:", error)

    // Return a fallback visualization based on the data type
    return generateFallbackVisualization(data, request)
  }
}

// Function to clean JSON string by removing ellipses and fixing common issues
function cleanJsonString(jsonString: string): string {
  const cleaned = jsonString
    // Replace ellipses in arrays with empty brackets or closing brackets
    .replace(/\[\s*\.{3}\s*\]/g, "[]")
    .replace(/\[\s*"[^"]*"\s*,\s*\.{3}\s*\]/g, '["placeholder"]')
    .replace(/\[\s*\d+\s*,\s*\.{3}\s*\]/g, "[0]")
    // Replace ellipses in the middle of arrays
    .replace(/,\s*\.{3}\s*,/g, ",")
    .replace(/,\s*\.{3}\s*\]/g, "]")
    .replace(/\[\s*\.{3}\s*,/g, "[")
    // Remove trailing commas in arrays and objects
    .replace(/,\s*\]/g, "]")
    .replace(/,\s*\}/g, "}")
    // Fix any remaining ellipses
    .replace(/\.{3}/g, "")
    // Remove any comments
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")

  return cleaned
}

// Function to extract visualization config from text when JSON parsing fails
function extractVisualizationFromText(text: string, request: string, data: any): VisualizationConfig | null {
  try {
    // Try to extract type
    const typeMatch = text.match(/"type"\s*:\s*"(bar|line|pie|donut)"/i)
    const type = typeMatch ? (typeMatch[1] as "bar" | "line" | "pie" | "donut") : "bar"

    // Try to extract title
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/i)
    const title = titleMatch ? titleMatch[1] : `Visualization for ${request.substring(0, 20)}`

    // Try to extract description
    const descMatch = text.match(/"description"\s*:\s*"([^"]+)"/i)
    const description = descMatch ? descMatch[1] : "Generated visualization"

    // Try to extract labels and values
    const labelsMatch = text.match(/"labels"\s*:\s*\[(.*?)\]/s)
    const valuesMatch = text.match(/"values"\s*:\s*\[(.*?)\]/s)

    let labels: string[] = []
    let values: number[] = []

    if (labelsMatch && valuesMatch) {
      // Try to parse labels
      const labelsStr = labelsMatch[1]
      labels = labelsStr
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.startsWith('"') && l.endsWith('"'))
        .map((l) => l.substring(1, l.length - 1))
        .filter(Boolean)
        .slice(0, 5)

      // Try to parse values
      const valuesStr = valuesMatch[1]
      values = valuesStr
        .split(",")
        .map((v) => Number.parseFloat(v.trim()))
        .filter((v) => !isNaN(v))
        .slice(0, labels.length)
    }

    // If we couldn't extract valid labels and values, create some from the data
    if (labels.length === 0 || values.length === 0 || labels.length !== values.length) {
      return null
    }

    return {
      type,
      title,
      description,
      data: {
        labels,
        values,
        datasetLabel: "Value",
      },
    }
  } catch (error) {
    console.error("Error extracting visualization from text:", error)
    return null
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

// Function to generate a fallback visualization based on the data type and request
function generateFallbackVisualization(data: any, request = ""): VisualizationConfig {
  // Default fallback
  let fallback: VisualizationConfig = {
    type: "bar",
    title: "Sample Health Indicators",
    description: "Fallback visualization with sample data",
    data: {
      labels: ["Indicator 1", "Indicator 2", "Indicator 3", "Indicator 4", "Indicator 5"],
      values: [12, 19, 3, 5, 2],
      datasetLabel: "Health Metrics",
    },
  }

  // Try to create a more meaningful fallback based on the actual data
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    try {
      // Determine chart type based on request
      let chartType: "bar" | "line" | "pie" | "donut" = "bar"
      if (request.toLowerCase().includes("pie") || request.toLowerCase().includes("distribution")) {
        chartType = "pie"
      } else if (request.toLowerCase().includes("line") || request.toLowerCase().includes("trend")) {
        chartType = "line"
      } else if (request.toLowerCase().includes("donut")) {
        chartType = "donut"
      }

      // Extract title from request
      let title = "Data Visualization"
      const titleMatch = request.match(
        /(?:show|create|generate|make|visualize)\s+(?:a|an)?\s+(?:chart|graph|plot|visualization)?\s+(?:of|for)?\s+(.+?)(?:\s+by|\s+with|\s+using|\s+from|\s+in|\s+\?|$)/i,
      )
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim()
        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1)
      }

      // Check if data has name/id fields (common in health data)
      const firstItem = data[0]
      const keys = Object.keys(firstItem)

      // Find potential categorical fields (for labels)
      const categoricalFields = keys.filter(
        (key) => typeof firstItem[key] === "string" && !["id", "uuid", "guid"].includes(key.toLowerCase()),
      )

      // Find potential numeric fields (for values)
      const numericFields = keys.filter(
        (key) =>
          !isNaN(Number(firstItem[key])) && firstItem[key] !== "" && !["id", "level"].includes(key.toLowerCase()),
      )

      if (categoricalFields.length > 0 && numericFields.length > 0) {
        // Select fields based on the request if possible
        let selectedCatField = categoricalFields[0]
        let selectedNumField = numericFields[0]

        // Try to find fields mentioned in the request
        for (const field of categoricalFields) {
          if (request.toLowerCase().includes(field.toLowerCase())) {
            selectedCatField = field
            break
          }
        }

        for (const field of numericFields) {
          if (request.toLowerCase().includes(field.toLowerCase())) {
            selectedNumField = field
            break
          }
        }

        // Get unique categories and their values (limit to 7)
        const categories = Array.from(new Set(data.map((item) => item[selectedCatField])))
          .filter(Boolean)
          .slice(0, 7)
          .map(String)

        if (categories.length > 0) {
          const values = categories.map((category) => {
            const matchingItems = data.filter((item) => String(item[selectedCatField]) === category)
            const sum = matchingItems.reduce((acc, item) => acc + (Number(item[selectedNumField]) || 0), 0)
            return sum || Math.floor(Math.random() * 100) // Fallback to random if sum is 0
          })

          fallback = {
            type: chartType,
            title: title || `${selectedNumField} by ${selectedCatField}`,
            description: `Shows the distribution of ${selectedNumField} across different ${selectedCatField} categories`,
            data: {
              labels: categories,
              values,
              datasetLabel: selectedNumField,
            },
          }
        }
      }
    } catch (error) {
      console.error("Error creating fallback visualization:", error)
      // Use the default fallback if anything goes wrong
    }
  }

  return fallback
}
