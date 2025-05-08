"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useData } from "@/context/data-context"
import { BarChart } from "@/components/charts/bar-chart"
import { LineChart } from "@/components/charts/line-chart"
import { PieChart } from "@/components/charts/pie-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { Search, Filter, BarChartIcon, LineChartIcon, PieChartIcon, Layers } from "lucide-react"
import type { VisualizationConfig } from "@/types/visualization"

export function Dashboard() {
  const { visualizations, summary } = useData()
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState<"default" | "asc" | "desc">("default")

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
          <div className="text-center max-w-md">
            <BarChartIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Try asking something like "Show me a bar chart of health indicators by region" or "Create a pie chart of
              disease distribution"
            </p>
            <Button variant="outline" className="mt-2">
              Auto-Generate Visualizations
            </Button>
          </div>
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

  // Filter visualizations based on search term
  const filteredVisualizations = visualizations.filter(
    (viz) =>
      viz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      viz.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Sort visualizations
  const sortedVisualizations = [...filteredVisualizations].sort((a, b) => {
    if (sortOrder === "asc") {
      return a.title.localeCompare(b.title)
    } else if (sortOrder === "desc") {
      return b.title.localeCompare(a.title)
    }
    return 0
  })

  // Filter and sort grouped visualizations
  const filteredGroupedVisualizations = chartTypes.reduce(
    (acc, type) => {
      acc[type] = sortedVisualizations.filter((v) => v.type === type)
      return acc
    },
    {} as Record<string, VisualizationConfig[]>,
  )

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Data Summary</CardTitle>
          <CardDescription>AI-generated summary of your health data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{summary}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Visualizations</h2>
          <div className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm font-medium">
            {visualizations.length} charts
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search visualizations..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "default" | "asc" | "desc")}>
            <SelectTrigger className="w-full sm:w-40">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Sort by</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="asc">Title (A-Z)</SelectItem>
              <SelectItem value="desc">Title (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="w-full">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Visualization Dashboard</CardTitle>
              <CardDescription>AI-generated visualizations based on your health data</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span>
                Showing {sortedVisualizations.length} of {visualizations.length} visualizations
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 mt-4">
            <TabsList className="w-full justify-start border-b pb-0">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <BarChartIcon className="h-4 w-4" />
                <span>All Charts</span>
                <span className="ml-1 bg-muted rounded-full px-2 py-0.5 text-xs">{sortedVisualizations.length}</span>
              </TabsTrigger>

              {chartTypes.map(
                (type) =>
                  filteredGroupedVisualizations[type].length > 0 && (
                    <TabsTrigger key={type} value={type} className="flex items-center gap-2">
                      {type === "bar" && <BarChartIcon className="h-4 w-4" />}
                      {type === "line" && <LineChartIcon className="h-4 w-4" />}
                      {type === "pie" && <PieChartIcon className="h-4 w-4" />}
                      {type === "donut" && <PieChartIcon className="h-4 w-4" />}
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                      <span className="ml-1 bg-muted rounded-full px-2 py-0.5 text-xs">
                        {filteredGroupedVisualizations[type].length}
                      </span>
                    </TabsTrigger>
                  ),
              )}
            </TabsList>

            <TabsContent value="all" className="space-y-6 pt-4">
              {sortedVisualizations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No visualizations match your search criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {sortedVisualizations.map((viz, index) => (
                    <VisualizationCard key={index} config={viz} />
                  ))}
                </div>
              )}
            </TabsContent>

            {chartTypes.map(
              (type) =>
                filteredGroupedVisualizations[type].length > 0 && (
                  <TabsContent key={type} value={type} className="space-y-6 pt-4">
                    {filteredGroupedVisualizations[type].length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">No {type} charts match your search criteria</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {filteredGroupedVisualizations[type].map((viz, index) => (
                          <VisualizationCard key={index} config={viz} />
                        ))}
                      </div>
                    )}
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
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2 bg-muted/30">
        <CardTitle className="text-lg">{config.title}</CardTitle>
        <CardDescription className="text-sm line-clamp-2">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[250px] p-4">
        {config.type === "bar" && <BarChart data={config.data} />}
        {config.type === "line" && <LineChart data={config.data} />}
        {config.type === "pie" && <PieChart data={config.data} />}
        {config.type === "donut" && <DonutChart data={config.data} />}
      </CardContent>
      <CardFooter className="bg-muted/30 py-2 px-4 text-xs text-muted-foreground flex justify-between">
        <div className="flex items-center gap-1">
          {config.type === "bar" && <BarChartIcon className="h-3 w-3" />}
          {config.type === "line" && <LineChartIcon className="h-3 w-3" />}
          {config.type === "pie" && <PieChartIcon className="h-3 w-3" />}
          {config.type === "donut" && <PieChartIcon className="h-3 w-3" />}
          <span>{config.type.charAt(0).toUpperCase() + config.type.slice(1)} Chart</span>
        </div>
        <span>{config.data.labels.length} data points</span>
      </CardFooter>
    </Card>
  )
}
