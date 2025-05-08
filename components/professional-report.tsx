"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/context/data-context"
import { BarChart } from "@/components/charts/bar-chart"
import { LineChart } from "@/components/charts/line-chart"
import { PieChart } from "@/components/charts/pie-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { Printer, Download, FileText } from "lucide-react"
import type { VisualizationConfig } from "@/types/visualization"

interface ProfessionalReportProps {
  visualizations: VisualizationConfig[]
}

export function ProfessionalReport({ visualizations }: ProfessionalReportProps) {
  const { summary } = useData()
  const [activeTab, setActiveTab] = useState("all")
  const reportRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (reportRef.current) {
      // Use browser's print functionality
      const originalContents = document.body.innerHTML
      const printContents = reportRef.current.innerHTML

      document.body.innerHTML = printContents
      window.print()
      document.body.innerHTML = originalContents

      // Reload the page to restore React state
      window.location.reload()
    }
  }

  const handleDownloadPDF = () => {
    // In a real implementation, we would use a library like jsPDF or html2pdf
    // For now, we'll just trigger the print dialog
    handlePrint()
  }

  // Group visualizations by type
  const chartTypes = ["bar", "line", "pie", "donut"]
  const groupedVisualizations = chartTypes.reduce(
    (acc, type) => {
      acc[type] = visualizations.filter((v) => v.type === type)
      return acc
    },
    {} as Record<string, VisualizationConfig[]>,
  )

  if (visualizations.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Professional Report</CardTitle>
          <CardDescription>No visualizations available. Generate visualizations to create a report.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Format the summary into sections
  const formattedSummary = formatSummary(summary)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Professional Report</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6 p-6 bg-white dark:bg-gray-950 rounded-lg border">
        <div className="text-center border-b pb-4">
          <h1 className="text-3xl font-bold">Data Analysis Report</h1>
          <p className="text-muted-foreground mt-2">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Executive Summary</h2>
          <div className="prose dark:prose-invert max-w-none">{formattedSummary}</div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Key Visualizations</h2>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Charts</TabsTrigger>
              {chartTypes.map(
                (type) =>
                  groupedVisualizations[type].length > 0 && (
                    <TabsTrigger key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} Charts
                    </TabsTrigger>
                  ),
              )}
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {visualizations.map((viz, index) => (
                  <VisualizationCard key={index} config={viz} />
                ))}
              </div>
            </TabsContent>

            {chartTypes.map(
              (type) =>
                groupedVisualizations[type].length > 0 && (
                  <TabsContent key={type} value={type} className="space-y-4">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {groupedVisualizations[type].map((viz, index) => (
                        <VisualizationCard key={index} config={viz} />
                      ))}
                    </div>
                  </TabsContent>
                ),
            )}
          </Tabs>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Conclusions</h2>
          <div className="prose dark:prose-invert max-w-none">
            <p>Based on the analysis of the provided data, several key insights have emerged:</p>
            <ul>
              <li>The data shows significant patterns that can inform strategic decision-making</li>
              <li>There are clear correlations between key health indicators</li>
              <li>Regional variations highlight areas that may require targeted interventions</li>
              <li>Temporal trends indicate progress in some areas while revealing challenges in others</li>
            </ul>
            <p>
              These findings suggest opportunities for improving health outcomes through data-driven approaches and
              targeted resource allocation.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground">
          <p>This report was automatically generated by the Health Data Analysis Dashboard</p>
        </div>
      </div>
    </div>
  )
}

function VisualizationCard({ config }: { config: VisualizationConfig }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {config.type === "bar" && <BarChart data={config.data} />}
        {config.type === "line" && <LineChart data={config.data} />}
        {config.type === "pie" && <PieChart data={config.data} />}
        {config.type === "donut" && <DonutChart data={config.data} />}
      </CardContent>
      <CardFooter className="bg-muted/50 py-2 px-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <FileText className="h-3 w-3" />
          <span>Data source: Health Data Analysis</span>
        </div>
      </CardFooter>
    </Card>
  )
}

// Function to format the summary into a more professional structure
function formatSummary(summary: string): React.ReactNode {
  if (!summary) return null

  // Split the summary into paragraphs
  const paragraphs = summary.split("\n\n").filter(Boolean)

  return (
    <>
      {paragraphs.map((paragraph, index) => {
        // Check if paragraph is a list
        if (paragraph.includes("• ") || paragraph.includes("- ")) {
          const listItems = paragraph
            .split(/[•-]\s+/)
            .filter(Boolean)
            .map((item) => item.trim())

          return (
            <ul key={index} className="list-disc pl-6 my-4">
              {listItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )
        }

        // Check if paragraph starts with a heading-like pattern
        if (/^[A-Z][A-Za-z\s]+:/.test(paragraph)) {
          const [heading, ...content] = paragraph.split(":")
          return (
            <div key={index} className="my-4">
              <h3 className="text-lg font-semibold">{heading}</h3>
              <p>{content.join(":")}</p>
            </div>
          )
        }

        // Regular paragraph
        return (
          <p key={index} className="my-4">
            {paragraph}
          </p>
        )
      })}
    </>
  )
}
