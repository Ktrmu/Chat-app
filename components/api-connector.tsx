"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useData } from "@/context/data-context"
import { analyzeData } from "@/lib/analyze-data"
import { Globe, ChevronRight } from "lucide-react"

interface APIConnectorProps {
  onDataFetched: () => void
}

export function APIConnector({ onDataFetched }: APIConnectorProps) {
  const [apiUrl, setApiUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [authType, setAuthType] = useState("none")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { setData, setSummary } = useData()

  const handleConnect = async () => {
    if (!apiUrl) {
      toast({
        title: "Missing URL",
        description: "Please enter an API URL.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Prepare headers based on auth type
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (authType === "api-key" && apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`
      } else if (authType === "x-api-key" && apiKey) {
        headers["x-api-key"] = apiKey
      }

      // Fetch data from the API
      const response = await fetch(apiUrl, {
        headers,
      })

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`)
      }

      const apiData = await response.json()

      // Check if we got valid data
      if (!apiData || (Array.isArray(apiData) && apiData.length === 0)) {
        throw new Error("API returned empty data")
      }

      setData(apiData)

      // Analyze the data
      const summary = await analyzeData(apiData)
      setSummary(summary)

      onDataFetched()

      toast({
        title: "API Connected",
        description: "Successfully fetched and analyzed data from the API.",
      })
    } catch (error) {
      console.error("Error connecting to API:", error)
      toast({
        title: "Connection Error",
        description: `Failed to connect to the API: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Data Source</CardTitle>
        <CardDescription>Connect to an external API to fetch data for analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-url">API URL</Label>
          <Input
            id="api-url"
            placeholder="https://api.example.com/data"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Enter the full URL of the API endpoint that returns JSON data</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-type">Authentication Type</Label>
          <Select value={authType} onValueChange={setAuthType}>
            <SelectTrigger id="auth-type">
              <SelectValue placeholder="Select authentication type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Authentication</SelectItem>
              <SelectItem value="api-key">Bearer Token</SelectItem>
              <SelectItem value="x-api-key">API Key (x-api-key header)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authType !== "none" && (
          <div className="space-y-2">
            <Label htmlFor="api-key">{authType === "api-key" ? "Bearer Token" : "API Key"}</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={authType === "api-key" ? "Your bearer token" : "Your API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}

        <Button onClick={handleConnect} disabled={isLoading} className="w-full">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>Connect to API</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
