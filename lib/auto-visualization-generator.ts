"use server"

import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"
import type { VisualizationConfig } from "@/types/visualization"

// Cache for storing auto-generated visualizations
const autoVisualizationCache = new Map<string, { visualizations: VisualizationConfig[]; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes in milliseconds

// Function to automatically generate multiple visualizations from data
export async function generateAutoVisualizations(data: any): Promise<VisualizationConfig[]> {
  try {
    // Create a cache key based on a simplified version of the data
    const cacheKey = JSON.stringify(data).substring(0, 200)

    // Check if we have cached visualizations
    const cachedVisualizations = autoVisualizationCache.get(cacheKey)
    if (cachedVisualizations && Date.now() - cachedVisualizations.timestamp < CACHE_TTL) {
      console.log("Using cached auto-visualizations")
      return cachedVisualizations.visualizations
    }

    // If data is not an array or is empty, return empty array
    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    // Extract a sample of the data for analysis - reduced sample size
    const sampleData = data.slice(0, 5) // Reduced from 10
    const dataString = JSON.stringify(sampleData, null, 2)

    // Get field information
    const fields = Object.keys(data[0])
    const numericFields = fields.filter((field) => !isNaN(Number(data[0][field])) && data[0][field] !== "")
    const categoricalFields = fields.filter(
      (field) => typeof data[0][field] === "string" && !numericFields.includes(field),
    )

    // If we don't have both numeric and categorical fields, return empty array
    if (numericFields.length === 0 || categoricalFields.length === 0) {
      return []
    }

    // Limit the number of fields to reduce token usage
    const limitedNumericFields = numericFields.slice(0, 3)
    const limitedCategoricalFields = categoricalFields.slice(0, 3)

    // Implement retry logic with exponential backoff
    const maxRetries = 3
    let retryDelay = 1000 // Start with 1 second delay
    let lastError: any = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Generate visualization suggestions using LLM - reduced token usage
        const { text } = await generateText({
          model: groq("llama-3.1-8b-instant"),
          prompt: `
            You are a data visualization expert. Based on the provided data sample, suggest 3 different visualizations that would be most insightful.
            For each visualization, provide a JSON object with the following structure:
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
            4. Return your response as a valid JSON array containing these 3 visualization objects
            5. Make sure all JSON syntax is correct and all quotes are properly escaped
            
            Available categorical fields: ${limitedCategoricalFields.join(", ")}
            Available numeric fields: ${limitedNumericFields.join(", ")}
            
            DATA SAMPLE:
            ${dataString}
            
            VISUALIZATIONS:
          `,
          maxTokens: 1200, // Reduced from 2000
        })

        // Extract the JSON array from the response
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/m)
        if (!jsonMatch) {
          console.error("Could not extract JSON array from response")
          throw new Error("Failed to extract JSON array from response")
        }

        try {
          // Clean up any potential ellipses or invalid JSON syntax before parsing
          const cleanedJsonString = cleanJsonString(jsonMatch[0])

          // Parse the cleaned JSON
          const visualizations = JSON.parse(cleanedJsonString)

          // Validate each visualization
          const validVisualizations = visualizations
            .filter((viz: any) => {
              // Basic validation
              if (!viz.type || !viz.title || !viz.data) return false

              // Ensure labels and values are arrays
              if (!Array.isArray(viz.data.labels) || !Array.isArray(viz.data.values)) return false

              // Ensure arrays have the same length
              if (viz.data.labels.length !== viz.data.values.length) {
                // Fix the arrays to have the same length
                const minLength = Math.min(viz.data.labels.length, viz.data.values.length)
                viz.data.labels = viz.data.labels.slice(0, minLength)
                viz.data.values = viz.data.values.slice(0, minLength)
              }

              return true
            })
            .slice(0, 3) // Ensure we only return up to 3 visualizations

          if (validVisualizations.length === 0) {
            return generateFallbackVisualizations(data, limitedCategoricalFields, limitedNumericFields)
          }

          // Cache the successful visualizations
          autoVisualizationCache.set(cacheKey, {
            visualizations: validVisualizations,
            timestamp: Date.now(),
          })

          return validVisualizations
        } catch (parseError) {
          console.error("Error parsing visualizations:", parseError)
          throw new Error("Failed to parse visualizations")
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

    console.error(`Failed after ${maxRetries} attempts. Last error:`, lastError)
    return generateFallbackVisualizations(data, limitedCategoricalFields, limitedNumericFields)
  } catch (error) {
    console.error("Error generating auto visualizations:", error)
    return []
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

// Function to generate fallback visualizations when LLM fails - unchanged
function generateFallbackVisualizations(
  data: any[],
  categoricalFields: string[],
  numericFields: string[],
): VisualizationConfig[] {
  const visualizations: VisualizationConfig[] = []

  try {
    // Generate up to 5 visualizations based on available fields
    const maxVisualizations = Math.min(5, categoricalFields.length * numericFields.length)

    // Use different combinations of fields
    for (let i = 0; i < maxVisualizations && i < 5; i++) {
      const catField = categoricalFields[i % categoricalFields.length]
      const numField = numericFields[Math.floor(i / categoricalFields.length) % numericFields.length]

      // Get unique categories and their values
      const categories = Array.from(new Set(data.map((item) => item[catField])))
        .filter(Boolean)
        .slice(0, 8) // Limit to 8 categories

      if (categories.length === 0) continue

      const values = categories.map((category) => {
        const matchingItems = data.filter((item) => item[catField] === category)
        const sum = matchingItems.reduce((acc, item) => acc + (Number(item[numField]) || 0), 0)
        return sum
      })

      // Determine the best chart type based on the data
      let chartType: "bar" | "line" | "pie" | "donut" = "bar"

      if (categories.length <= 5) {
        // Use pie/donut for small number of categories
        chartType = i % 2 === 0 ? "pie" : "donut"
      } else if (categories.some((cat) => /^\d{4}(-\d{2})?(-\d{2})?$/.test(String(cat)))) {
        // Use line chart for date-like categories
        chartType = "line"
      }

      visualizations.push({
        type: chartType,
        title: `${numField.charAt(0).toUpperCase() + numField.slice(1)} by ${catField}`,
        description: `Distribution of ${numField} across different ${catField} categories`,
        data: {
          labels: categories.map(String),
          values,
          datasetLabel: numField,
        },
      })
    }

    return visualizations
  } catch (error) {
    console.error("Error generating fallback visualizations:", error)
    return []
  }
}
