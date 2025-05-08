"use client"

import { useState, useRef } from "react"
import { FileUploader } from "./file-uploader"
import { APIConnector } from "./api-connector"
import { WhatsAppConnector } from "./whatsapp-connector"
import { ChatInterface } from "./chat-interface"
import { Dashboard } from "./dashboard"
import { ProfessionalReport } from "./professional-report"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Printer, BarChart } from "lucide-react"
import { DataProvider } from "@/context/data-context"
import { generateAutoVisualizations } from "@/lib/auto-visualization-generator"

// Main container component that provides the DataProvider context
export function DataAnalysisDashboard() {
  return (
    <DataProvider>
      <DashboardContent />
    </DataProvider>
  )
}

// Inner component that uses the DataProvider context
import { useData } from "@/context/data-context"

function DashboardContent() {
  const [activeTab, setActiveTab] = useState("upload")
  const [hasData, setHasData] = useState(false)
  const [isGeneratingVisualizations, setIsGeneratingVisualizations] = useState(false)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { data, addVisualization, visualizations } = useData()

  const handlePrint = () => {
    if (dashboardRef.current) {
      // Use browser's print functionality
      const originalContents = document.body.innerHTML
      const printContents = dashboardRef.current.innerHTML

      document.body.innerHTML = printContents
      window.print()
      document.body.innerHTML = originalContents

      // Reload the page to restore React state
      window.location.reload()
    }
  }

  const handleDataLoaded = () => {
    setHasData(true)
    setActiveTab("chat")

    // Automatically generate visualizations when data is loaded
    generateVisualizations()
  }

  const generateVisualizations = async () => {
    if (!data || isGeneratingVisualizations) return

    setIsGeneratingVisualizations(true)

    try {
      const autoVisualizations = await generateAutoVisualizations(data)

      // Add each visualization to the state
      autoVisualizations.forEach((viz) => {
        addVisualization(viz)
      })

      if (autoVisualizations.length > 0) {
        // Show a notification or update UI to indicate visualizations were created
        console.log(`Generated ${autoVisualizations.length} visualizations automatically`)
      }
    } catch (error) {
      console.error("Error generating automatic visualizations:", error)
    } finally {
      setIsGeneratingVisualizations(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Health Data Analysis Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Connect to health data sources, analyze data, and generate professional reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="upload">Data Sources</TabsTrigger>
            <TabsTrigger value="chat" disabled={!hasData}>
              Chat & Analyze
            </TabsTrigger>
            <TabsTrigger value="dashboard" disabled={!hasData}>
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="report" disabled={!hasData || visualizations.length === 0}>
              Professional Report
            </TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Integration</TabsTrigger>
          </TabsList>

          {hasData && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateVisualizations}
                disabled={isGeneratingVisualizations}
                className="flex items-center gap-2"
              >
                <BarChart className="h-4 w-4" />
                {isGeneratingVisualizations ? "Generating..." : "Auto-Generate Visualizations"}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Export as PDF
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="upload" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <APIConnector onDataFetched={handleDataLoaded} />
            <div className="flex flex-col">
              <h3 className="text-lg font-medium mb-2">Upload Your Own Data</h3>
              <FileUploader onDataUploaded={handleDataLoaded} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <ChatInterface onVisualizationCreated={() => setActiveTab("dashboard")} />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <div ref={dashboardRef}>
            <Dashboard />
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <ProfessionalReport visualizations={visualizations} />
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppConnector />
        </TabsContent>
      </Tabs>
    </div>
  )
}
