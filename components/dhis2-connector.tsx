"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useData } from "@/context/data-context"
import { fetchDhis2Data } from "@/lib/dhis2-service"
import { Database, Server, ChevronRight, AlertCircle } from "lucide-react"

interface DHIS2ConnectorProps {
  onDataFetched: () => void
}

export function DHIS2Connector({ onDataFetched }: DHIS2ConnectorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("demo")
  const [customUrl, setCustomUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [dataType, setDataType] = useState("indicators")
  const { toast } = useToast()
  const { setData, setSummary } = useData()

  // Demo datasets available in DHIS2 Play
  const demoDatasets = [
    { id: "indicators", name: "Key Indicators" },
    { id: "dataElements", name: "Data Elements" },
    { id: "dataSets", name: "Data Sets" },
    { id: "organisationUnits", name: "Organization Units" },
    { id: "programs", name: "Programs" },
  ]

  const handleConnectDemo = async () => {
    setIsLoading(true)

    try {
      // Use the DHIS2 Play demo instance with sample data
      const dhis2Data = await fetchDhis2Data({
        url: "https://play.dhis2.org/demo",
        username: "admin",
        password: "district",
        dataType,
      })

      setData(dhis2Data)

      // Generate a basic summary
      const summary = `Successfully loaded ${dataType} data from DHIS2 Play demo instance. 
      The dataset contains ${dhis2Data.length} records with information about ${dataType}.
      You can now ask questions about this health data or request visualizations.`

      setSummary(summary)
      onDataFetched()

      toast({
        title: "Connected to DHIS2 Play",
        description: `Successfully loaded ${dataType} data from the demo instance.`,
      })
    } catch (error) {
      console.error("Error connecting to DHIS2 Play:", error)
      toast({
        title: "Connection Error",
        description: `Failed to connect to DHIS2 Play: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectCustom = async () => {
    if (!customUrl) {
      toast({
        title: "Missing URL",
        description: "Please enter a DHIS2 server URL.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const dhis2Data = await fetchDhis2Data({
        url: customUrl,
        username,
        password,
        dataType,
      })

      setData(dhis2Data)

      // Generate a basic summary
      const summary = `Successfully fetched ${dataType} data from custom DHIS2 instance. 
      The dataset contains ${dhis2Data.length} records with information about ${dataType}.
      You can now ask questions about this health data or request visualizations.`

      setSummary(summary)
      onDataFetched()

      toast({
        title: "Connected to DHIS2",
        description: `Successfully fetched ${dataType} data from your DHIS2 instance.`,
      })
    } catch (error) {
      console.error("Error connecting to DHIS2:", error)
      toast({
        title: "Connection Error",
        description: "Failed to connect to your DHIS2 instance. Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Connect to DHIS2</CardTitle>
        <CardDescription>Fetch health data directly from DHIS2 for analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="demo">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span>DHIS2 Play Demo</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="custom">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Custom DHIS2 Server</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-dataset">Select Dataset</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger id="demo-dataset">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {demoDatasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Due to DHIS2 Play authentication limitations, we're using sample data for demonstration purposes. For
                  production use, connect to your own DHIS2 instance.
                </p>
              </div>
            </div>

            <Button onClick={handleConnectDemo} disabled={isLoading} className="w-full">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Loading data...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Load Demo Data</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dhis2-url">DHIS2 Server URL</Label>
              <Input
                id="dhis2-url"
                placeholder="https://your-dhis2-instance.org"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dhis2-username">Username</Label>
              <Input
                id="dhis2-username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dhis2-password">Password</Label>
              <Input
                id="dhis2-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-dataset">Select Dataset</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger id="custom-dataset">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {demoDatasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleConnectCustom} disabled={isLoading} className="w-full">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Connect to Custom DHIS2</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
