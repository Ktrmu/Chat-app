"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileText, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useData } from "@/context/data-context"
import { analyzeData } from "@/lib/analyze-data"

interface FileUploaderProps {
  onDataUploaded: () => void
}

export function FileUploader({ onDataUploaded }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { toast } = useToast()
  const { setData, setSummary } = useData()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const fileType = file.name.split(".").pop()?.toLowerCase()
    if (!["csv", "json", "txt"].includes(fileType || "")) {
      toast({
        title: "Unsupported file format",
        description: "Please upload a CSV, JSON, or TXT file.",
        variant: "destructive",
      })
      return
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      const text = await file.text()
      let parsedData

      // Parse the file based on its type
      if (fileType === "csv") {
        parsedData = parseCSV(text)
      } else if (fileType === "json") {
        parsedData = JSON.parse(text)
      } else {
        parsedData = { text }
      }

      setData(parsedData)
      setIsUploading(false)

      // Analyze the data using LLM
      setIsAnalyzing(true)
      const summary = await analyzeData(parsedData)
      setSummary(summary)
      setIsAnalyzing(false)

      onDataUploaded()

      toast({
        title: "Data uploaded successfully",
        description: "Your data has been uploaded and analyzed.",
      })
    } catch (error) {
      console.error("Error processing file:", error)
      setIsUploading(false)
      setIsAnalyzing(false)

      toast({
        title: "Error processing file",
        description: "There was an error processing your file. Please try again with a smaller or simpler file.",
        variant: "destructive",
      })
    }
  }

  // Simple CSV parser
  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim() !== "")
    if (lines.length === 0) return []

    const headers = lines[0].split(",").map((header) => header.trim())

    const data = lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.trim())
      return headers.reduce(
        (obj, header, index) => {
          obj[header] = values[index] || ""
          return obj
        },
        {} as Record<string, string>,
      )
    })

    return data
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-12 w-12 text-primary" />
          </div>

          <div className="space-y-2 text-center">
            <h3 className="text-xl font-semibold">Upload your data file</h3>
            <p className="text-sm text-muted-foreground">Upload a CSV, JSON, or TXT file to analyze</p>
          </div>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <label htmlFor="file-upload" className="sr-only">
              Upload file
            </label>
            <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-6 py-10">
              <div className="space-y-2 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <div className="flex text-sm text-muted-foreground">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".csv,.json,.txt"
                      onChange={handleFileUpload}
                      disabled={isUploading || isAnalyzing}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-muted-foreground">CSV, JSON, or TXT up to 10MB</p>
              </div>
            </div>
          </div>

          {(isUploading || isAnalyzing) && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>{isUploading ? "Uploading..." : "Analyzing data..."}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Your data stays in your browser and is not stored on our servers
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
