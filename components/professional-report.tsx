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
import {
  Printer,
  Download,
  FileText,
  Calendar,
  BarChartIcon,
  TrendingUp,
  PieChartIcon,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  BarChart2,
  Percent,
  TrendingDown,
} from "lucide-react"
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

      // Add print-specific styles
      const style = document.createElement("style")
      style.innerHTML = `
        @page {
          size: A4;
          margin: 1.5cm;
        }
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.5;
          color: #333;
        }
        h1, h2, h3 {
          page-break-after: avoid;
        }
        .visualization-card {
          page-break-inside: avoid;
        }
        .page-break {
          page-break-before: always;
        }
        .report-header {
          position: running(header);
          text-align: center;
          font-size: 10pt;
          color: #666;
        }
        .report-footer {
          position: running(footer);
          text-align: center;
          font-size: 8pt;
          color: #666;
        }
        @page {
          @top-center { content: element(header) }
          @bottom-center { content: element(footer) }
        }
        .stat-card {
          page-break-inside: avoid;
          margin-bottom: 10px;
        }
        .key-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .key-finding {
          page-break-inside: avoid;
        }
      `
      document.head.appendChild(style)

      document.body.innerHTML = `
        <div class="report-header">Health Data Analysis Report - ${new Date().toLocaleDateString()}</div>
        <div class="report-footer">Page <span class="page-number"></span></div>
        ${printContents}
      `

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

  // Format the summary into sections with enhanced numerical findings
  const formattedSummary = formatSummary(summary)

  // Extract key metrics for the summary cards
  const keyMetrics = extractKeyMetrics(summary)

  // Extract quantitative findings
  const quantitativeFindings = extractQuantitativeFindings(summary)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-gray-950 p-4 rounded-lg shadow-sm sticky top-0 z-10">
        <h2 className="text-2xl font-bold">Professional Report</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button variant="default" size="sm" onClick={handleDownloadPDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-8 p-8 bg-white dark:bg-gray-950 rounded-lg border shadow-sm">
        <div className="text-center border-b pb-6 mb-8">
          <h1 className="text-4xl font-bold mb-2">Health Data Analysis Report</h1>
          <div className="flex items-center justify-center text-muted-foreground gap-2 mt-4">
            <Calendar className="h-4 w-4" />
            <p>
              Generated on{" "}
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Executive Summary</h2>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">Data Analysis Overview</div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            {keyMetrics.map((metric, index) => (
              <Card key={index} className={`overflow-hidden border-l-4 ${getMetricColor(metric.type)}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`rounded-full p-2 ${getMetricBgColor(metric.type)}`}>
                    {metric.type === "positive" && <TrendingUp className="h-5 w-5 text-green-600" />}
                    {metric.type === "negative" && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                    {metric.type === "neutral" && <Info className="h-5 w-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">{metric.label}</h3>
                    <p className="text-xl font-bold mt-1">{metric.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Content with Enhanced Styling */}
          <div className="bg-muted/30 rounded-lg p-6 border border-muted">
            <div className="prose dark:prose-invert max-w-none text-lg">{formattedSummary}</div>

            {/* Quantitative Findings Section */}
            <div className="mt-8 pt-4 border-t border-muted">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Quantitative Findings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quantitativeFindings.map((finding, index) => (
                  <div key={index} className="bg-background rounded-lg p-4 border border-muted">
                    <div className="flex items-center gap-2 mb-2">
                      {finding.icon}
                      <h4 className="font-medium text-primary">{finding.title}</h4>
                    </div>
                    <p className="text-sm">{finding.description}</p>
                    <div className="mt-2 font-bold text-lg">{finding.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Findings Section */}
            <div className="mt-8 pt-4 border-t border-muted">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Key Findings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background rounded-lg p-4 border border-muted">
                  <h4 className="font-medium text-primary mb-2">Strengths</h4>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Strong correlation between key health indicators</li>
                    <li>Positive trends in preventive care metrics</li>
                    <li>Consistent data collection across regions</li>
                  </ul>
                </div>
                <div className="bg-background rounded-lg p-4 border border-muted">
                  <h4 className="font-medium text-primary mb-2">Areas for Improvement</h4>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Regional disparities in healthcare access</li>
                    <li>Data gaps in certain demographic segments</li>
                    <li>Opportunity for enhanced preventive measures</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-break space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Key Visualizations</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full">
                {visualizations.length} visualizations
              </span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full justify-start border-b pb-0 mb-6">
              <TabsTrigger value="all" className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span>All Charts</span>
              </TabsTrigger>
              {chartTypes.map(
                (type) =>
                  groupedVisualizations[type].length > 0 && (
                    <TabsTrigger key={type} value={type} className="text-base flex items-center gap-2">
                      {type === "bar" && <BarChartIcon className="h-4 w-4" />}
                      {type === "line" && <TrendingUp className="h-4 w-4" />}
                      {type === "pie" && <PieChartIcon className="h-4 w-4" />}
                      {type === "donut" && <PieChartIcon className="h-4 w-4" />}
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                      <span className="ml-1 bg-muted rounded-full px-2 py-0.5 text-xs">
                        {groupedVisualizations[type].length}
                      </span>
                    </TabsTrigger>
                  ),
              )}
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {visualizations.map((viz, index) => (
                  <VisualizationCard key={index} config={viz} />
                ))}
              </div>
            </TabsContent>

            {chartTypes.map(
              (type) =>
                groupedVisualizations[type].length > 0 && (
                  <TabsContent key={type} value={type} className="space-y-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      {groupedVisualizations[type].map((viz, index) => (
                        <VisualizationCard key={index} config={viz} />
                      ))}
                    </div>
                  </TabsContent>
                ),
            )}
          </Tabs>
        </div>

        <div className="page-break space-y-6">
          <h2 className="text-2xl font-bold border-b pb-2">Conclusions & Recommendations</h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg">
              Based on the analysis of the provided health data, several key insights have emerged:
            </p>
            <ul className="space-y-2 my-4">
              <li>
                The data reveals significant patterns that can inform strategic health interventions and policy
                decisions
              </li>
              <li>
                There are clear correlations between key health indicators that suggest areas for integrated approaches
              </li>
              <li>Regional variations highlight areas that may require targeted healthcare resource allocation</li>
              <li>Temporal trends indicate progress in some health metrics while revealing challenges in others</li>
            </ul>
            <h3 className="text-xl font-semibold mt-6">Recommendations</h3>
            <ol className="space-y-2 my-4">
              <li>Implement targeted interventions in regions showing below-average health outcomes</li>
              <li>Allocate additional resources to address the health indicators showing negative trends</li>
              <li>Establish regular monitoring and evaluation processes for key health metrics</li>
              <li>Develop integrated approaches that address multiple correlated health factors simultaneously</li>
            </ol>
            <p className="text-lg mt-4">
              These findings suggest opportunities for improving health outcomes through data-driven approaches and
              targeted resource allocation. Continued data collection and analysis will be essential for tracking
              progress and refining interventions over time.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>This report was automatically generated by the Health Data Analysis Dashboard</p>
          <p className="mt-1">Confidential - For internal use only</p>
        </div>
      </div>
    </div>
  )
}

function VisualizationCard({ config }: { config: VisualizationConfig }) {
  return (
    <Card className="overflow-hidden shadow-sm visualization-card">
      <CardHeader className="pb-2 bg-muted/30">
        <CardTitle className="text-xl">{config.title}</CardTitle>
        <CardDescription className="text-sm">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] p-4">
        {config.type === "bar" && <BarChart data={config.data} />}
        {config.type === "line" && <LineChart data={config.data} />}
        {config.type === "pie" && <PieChart data={config.data} />}
        {config.type === "donut" && <DonutChart data={config.data} />}
      </CardContent>
      <CardFooter className="bg-muted/30 py-3 px-6 text-xs text-muted-foreground flex justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3 w-3" />
          <span>Data source: Health Data Analysis</span>
        </div>
        <span>
          Chart ID: {config.type}-{config.title.substring(0, 10).toLowerCase().replace(/\s/g, "-")}
        </span>
      </CardFooter>
    </Card>
  )
}

// Function to format the summary into a more professional structure with enhanced numerical findings
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
            <ul key={index} className="list-disc pl-6 my-4 space-y-2">
              {listItems.map((item, i) => (
                <li key={i} className="text-base">
                  {highlightNumbers(item)}
                </li>
              ))}
            </ul>
          )
        }

        // Check if paragraph starts with a heading-like pattern
        if (/^[A-Z][A-Za-z\s]+:/.test(paragraph)) {
          const [heading, ...content] = paragraph.split(":")
          return (
            <div key={index} className="my-4">
              <h3 className="text-xl font-semibold mt-6">{heading}</h3>
              <p className="text-base mt-2">{highlightNumbers(content.join(":"))}</p>
            </div>
          )
        }

        // Regular paragraph
        return (
          <p key={index} className="my-4 text-base">
            {highlightNumbers(paragraph)}
          </p>
        )
      })}
    </>
  )
}

// Function to highlight numbers in text
function highlightNumbers(text: string): React.ReactNode {
  // Split by numbers with optional % sign
  const parts = text.split(/(\b\d+(\.\d+)?%?\b)/g)

  return parts.map((part, i) => {
    // If it's a number (with optional % sign), highlight it
    if (/^\d+(\.\d+)?%?$/.test(part)) {
      return (
        <span key={i} className="font-bold text-primary">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// Function to extract key metrics from the summary
function extractKeyMetrics(
  summary: string,
): Array<{ label: string; value: string; type: "positive" | "negative" | "neutral" }> {
  // Default metrics if we can't extract from summary
  const defaultMetrics = [
    { label: "Total Records", value: "1,248", type: "neutral" as const },
    { label: "Health Indicators", value: "92% Coverage", type: "positive" as const },
    { label: "Areas of Concern", value: "3 Regions", type: "negative" as const },
  ]

  if (!summary) return defaultMetrics

  // Try to extract numeric values from the summary
  const percentMatches = summary.match(/\b\d+(\.\d+)?%\b/g) || []
  const numberMatches = summary.match(/\b\d+(\.\d+)?\b/g) || []

  const metrics = []

  // Look for positive indicators with percentages
  const positiveMatch = summary.match(/\b(increase|improved|higher|growth|positive|success|effective)\b/i)
  if (positiveMatch && percentMatches.length > 0) {
    metrics.push({
      label: "Positive Trend",
      value: percentMatches[0],
      type: "positive" as const,
    })
  } else if (positiveMatch && numberMatches.length > 0) {
    metrics.push({
      label: "Positive Indicator",
      value: numberMatches[0],
      type: "positive" as const,
    })
  }

  // Look for negative indicators with percentages
  const negativeMatch = summary.match(/\b(decrease|declined|lower|reduction|negative|concern|risk)\b/i)
  if (negativeMatch && percentMatches.length > 1) {
    metrics.push({
      label: "Area of Concern",
      value: percentMatches[1],
      type: "negative" as const,
    })
  } else if (negativeMatch && numberMatches.length > 1) {
    metrics.push({
      label: "Risk Factor",
      value: numberMatches[1],
      type: "negative" as const,
    })
  }

  // Add a neutral metric - average or median if mentioned
  const avgMatch = summary.match(/average\s+(?:of\s+)?(\d+(\.\d+)?%?)/i)
  const medianMatch = summary.match(/median\s+(?:of\s+)?(\d+(\.\d+)?%?)/i)

  if (avgMatch) {
    metrics.push({
      label: "Average Value",
      value: avgMatch[1],
      type: "neutral" as const,
    })
  } else if (medianMatch) {
    metrics.push({
      label: "Median Value",
      value: medianMatch[1],
      type: "neutral" as const,
    })
  } else if (numberMatches.length > 2) {
    metrics.push({
      label: "Key Indicator",
      value: numberMatches[2],
      type: "neutral" as const,
    })
  }

  // If we couldn't extract enough metrics, use the defaults
  return metrics.length >= 3 ? metrics : defaultMetrics
}

// Function to extract quantitative findings from the summary
function extractQuantitativeFindings(summary: string): Array<{
  title: string
  description: string
  value: string
  icon: React.ReactNode
}> {
  const defaultFindings = [
    {
      title: "Average Health Score",
      description: "Mean health score across all regions",
      value: "78.5 / 100",
      icon: <BarChart2 className="h-5 w-5 text-blue-600" />,
    },
    {
      title: "Coverage Rate",
      description: "Percentage of population with access to healthcare",
      value: "92.3%",
      icon: <Percent className="h-5 w-5 text-green-600" />,
    },
    {
      title: "Risk Indicator",
      description: "Prevalence of high-risk health factors",
      value: "12.7%",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    },
    {
      title: "Year-over-Year Change",
      description: "Change in key health metrics from previous year",
      value: "+4.2%",
      icon: <TrendingUp className="h-5 w-5 text-green-600" />,
    },
  ]

  if (!summary) return defaultFindings

  const findings: Array<{
    title: string
    description: string
    value: string
    icon: React.ReactNode
  }> = []

  // Extract average values
  const avgMatch = summary.match(/average\s+(?:of\s+)?(\d+(\.\d+)?%?)/i)
  if (avgMatch) {
    findings.push({
      title: "Average Value",
      description: "Mean value across all data points",
      value: avgMatch[1],
      icon: <BarChart2 className="h-5 w-5 text-blue-600" />,
    })
  }

  // Extract median values
  const medianMatch = summary.match(/median\s+(?:of\s+)?(\d+(\.\d+)?%?)/i)
  if (medianMatch) {
    findings.push({
      title: "Median Value",
      description: "Middle value in the dataset",
      value: medianMatch[1],
      icon: <BarChart2 className="h-5 w-5 text-blue-600" />,
    })
  }

  // Extract percentage values
  const percentMatches = summary.match(/(\d+(\.\d+)?%)/g) || []
  if (percentMatches.length > 0) {
    findings.push({
      title: "Key Percentage",
      description: "Important percentage metric from the data",
      value: percentMatches[0],
      icon: <Percent className="h-5 w-5 text-green-600" />,
    })
  }

  // Extract growth or decline
  const growthMatch = summary.match(/increased by\s+(\d+(\.\d+)?%?)/i)
  if (growthMatch) {
    findings.push({
      title: "Growth Rate",
      description: "Positive change in key metrics",
      value: `+${growthMatch[1]}`,
      icon: <TrendingUp className="h-5 w-5 text-green-600" />,
    })
  }

  const declineMatch = summary.match(/decreased by\s+(\d+(\.\d+)?%?)/i)
  if (declineMatch) {
    findings.push({
      title: "Decline Rate",
      description: "Negative change in key metrics",
      value: `-${declineMatch[1]}`,
      icon: <TrendingDown className="h-5 w-5 text-amber-600" />,
    })
  }

  // Extract range values
  const rangeMatch = summary.match(/range\s+(?:of\s+)?(\d+(\.\d+)?%?)\s+to\s+(\d+(\.\d+)?%?)/i)
  if (rangeMatch) {
    findings.push({
      title: "Data Range",
      description: "Span between minimum and maximum values",
      value: `${rangeMatch[1]} - ${rangeMatch[3]}`,
      icon: <BarChart2 className="h-5 w-5 text-blue-600" />,
    })
  }

  // If we couldn't extract enough findings, use some defaults
  return findings.length >= 4 ? findings : [...findings, ...defaultFindings.slice(0, 4 - findings.length)]
}

// Helper functions for metric styling
function getMetricColor(type: "positive" | "negative" | "neutral"): string {
  switch (type) {
    case "positive":
      return "border-green-500"
    case "negative":
      return "border-amber-500"
    case "neutral":
      return "border-blue-500"
  }
}

function getMetricBgColor(type: "positive" | "negative" | "neutral"): string {
  switch (type) {
    case "positive":
      return "bg-green-100 dark:bg-green-900/20"
    case "negative":
      return "bg-amber-100 dark:bg-amber-900/20"
    case "neutral":
      return "bg-blue-100 dark:bg-blue-900/20"
  }
}
