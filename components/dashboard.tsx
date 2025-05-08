"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/context/data-context"
import { BarChart } from "@/components/charts/bar-chart"
import { LineChart } from "@/components/charts/line-chart"
import { PieChart } from "@/components/charts/pie-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import type { VisualizationConfig } from "@/types/visualization"

export function Dashboard() {
  const { visualizations, summary } = useData()
  const [activeTab, setActiveTab] = useState("all")

  if (visualizations.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            No visualizations yet. Ask questions in the chat to generate visualizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-center text-muted-foreground">
            Try asking something like "Show me a bar chart of sales by region" or "Create a pie chart of customer
            distribution"
          </p>
        </CardContent>
      </Card>
    )
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

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Data Summary</CardTitle>
          <CardDescription>AI-generated summary of your data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{summary}</p>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Visualizations</CardTitle>
          <CardDescription>AI-generated visualizations based on your data</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visualizations.map((viz, index) => (
                  <VisualizationCard key={index} config={viz} />
                ))}
              </div>
            </TabsContent>

            {chartTypes.map(
              (type) =>
                groupedVisualizations[type].length > 0 && (
                  <TabsContent key={type} value={type} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {groupedVisualizations[type].map((viz, index) => (
                        <VisualizationCard key={index} config={viz} />
                      ))}
                    </div>
                  </TabsContent>
                ),
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function VisualizationCard({ config }: { config: VisualizationConfig }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {config.type === "bar" && <BarChart data={config.data} />}
        {config.type === "line" && <LineChart data={config.data} />}
        {config.type === "pie" && <PieChart data={config.data} />}
        {config.type === "donut" && <DonutChart data={config.data} />}
      </CardContent>
    </Card>
  )
}
