"use server"

import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"
import type { VisualizationConfig } from "@/types/visualization"

export async function generateVisualization(request: string, data: any): Promise<VisualizationConfig> {
  try {
    // Function to extract relevant data for visualization
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
          return data.slice(0, 15) // Return first 15 items
        }

        // Otherwise just return a sample of the data
        return data.slice(0, 15)
      }

      return data
    }

    // Determine if this is health data from DHIS2
    const isHealthData = detectHealthData(data)

    // Add health data context if applicable
    const healthContext = isHealthData
      ? `This appears to be health data, possibly from DHIS2. 
         When creating visualizations, focus on health metrics and indicators.
         Choose appropriate chart types for health data (e.g., bar charts for comparing indicators across regions,
         line charts for trends over time, pie charts for proportional distribution of health conditions).`
      : ""

    // Extract relevant data for visualization
    const visualizationData = extractVisualizationData(data, request)

    // Convert to a string representation for the LLM
    const dataString = JSON.stringify(visualizationData, null, 2)

    // Generate visualization configuration using Groq
    const { text } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      prompt: `
        You are a data visualization expert specializing in health data. Create a visualization configuration based on the user's request and the provided data sample.
        Return ONLY a valid JSON object with the following structure:
        {
          "type": "bar" | "line" | "pie" | "donut",
          "title": "Title of the visualization",
          "description": "Brief description of what the visualization shows",
          "data": {
            "labels": ["Label1", "Label2", ...],
            "values": [value1, value2, ...],
            "datasetLabel": "Optional label for the dataset"
          }
        }
        
        The data should be processed to create a meaningful visualization. For example:
        - For bar/pie charts: Extract categories and their counts/sums
        - For line charts: Extract time series or sequential data
        - Limit to 10 data points maximum for readability
        
        ${healthContext}
        
        DATA SAMPLE:
        ${dataString}
        
        USER REQUEST:
        ${request}
        
        IMPORTANT: Return ONLY the JSON object with no additional text before or after it.
      `,
      maxTokens: 1000,
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
      // Try to parse the extracted JSON
      const config = JSON.parse(jsonString)

      // Validate the configuration
      if (!config.type || !config.title || !config.data || !config.data.labels || !config.data.values) {
        console.error("Invalid visualization configuration:", config)
        throw new Error("Invalid visualization configuration structure")
      }

      return config
    } catch (parseError) {
      console.error("JSON parsing error:", parseError, "for string:", jsonString)
      throw new Error("Failed to parse visualization configuration")
    }
  } catch (error) {
    console.error("Error generating visualization:", error)

    // Return a fallback visualization based on the data type
    return generateFallbackVisualization(data)
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

// Function to generate a fallback visualization based on the data type
function generateFallbackVisualization(data: any): VisualizationConfig {
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
      // Check if data has name/id fields (common in DHIS2)
      if ("name" in data[0]) {
        // Get up to 5 items
        const items = data.slice(0, 5)
        const labels = items.map((item) => item.name || "Unknown")

        // Try to find a numeric field for values
        const keys = Object.keys(items[0])
        const numericField = keys.find(
          (key) => !isNaN(Number(items[0][key])) && items[0][key] !== "" && key !== "id" && key !== "level",
        )

        // If we found a numeric field, use it for values
        if (numericField) {
          const values = items.map((item) => Number(item[numericField]) || Math.floor(Math.random() * 100))

          fallback = {
            type: "bar",
            title: `${numericField.charAt(0).toUpperCase() + numericField.slice(1)} by Name`,
            description: `Showing ${numericField} values for different items`,
            data: {
              labels,
              values,
              datasetLabel: numericField,
            },
          }
        } else {
          // Otherwise use random values
          fallback = {
            type: "bar",
            title: "Data Overview",
            description: "Overview of the selected data items",
            data: {
              labels,
              values: items.map(() => Math.floor(Math.random() * 100)),
              datasetLabel: "Value",
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
