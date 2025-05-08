"use server"

import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"
import type { VisualizationConfig } from "@/types/visualization"

// Function to automatically generate multiple visualizations from data
export async function generateAutoVisualizations(data: any): Promise<VisualizationConfig[]> {
  try {
    // If data is not an array or is empty, return empty array
    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    // Extract a sample of the data for analysis
    const sampleData = data.slice(0, 10)
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

    // Generate visualization suggestions using LLM
    const { text } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      prompt: `
        You are a data visualization expert. Based on the provided data sample, suggest 5 different visualizations that would be most insightful.
        For each visualization, provide a JSON object with the following structure:
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
        
        Return your response as a JSON array containing these 5 visualization objects.
        
        Available categorical fields: ${categoricalFields.join(", ")}
        Available numeric fields: ${numericFields.join(", ")}
        
        DATA SAMPLE:
        ${dataString}
        
        VISUALIZATIONS:
      `,
      maxTokens: 2000,
    })

    // Extract the JSON array from the response
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/m)
    if (!jsonMatch) {
      console.error("Could not extract JSON array from response")
      return generateFallbackVisualizations(data, categoricalFields, numericFields)
    }

    try {
      const visualizations = JSON.parse(jsonMatch[0])

      // Validate each visualization
      const validVisualizations = visualizations.filter(
        (viz: any) =>
          viz.type && viz.title && viz.data && Array.isArray(viz.data.labels) && Array.isArray(viz.data.values),
      )

      if (validVisualizations.length === 0) {
        return generateFallbackVisualizations(data, categoricalFields, numericFields)
      }

      return validVisualizations
    } catch (parseError) {
      console.error("Error parsing visualizations:", parseError)
      return generateFallbackVisualizations(data, categoricalFields, numericFields)
    }
  } catch (error) {
    console.error("Error generating auto visualizations:", error)
    return []
  }
}

// Function to generate fallback visualizations when LLM fails
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
        title: `${numField} by ${catField}`,
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
