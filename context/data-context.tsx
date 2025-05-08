"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { VisualizationConfig } from "@/types/visualization"

interface DataContextType {
  data: any
  setData: (data: any) => void
  summary: string
  setSummary: (summary: string) => void
  visualizations: VisualizationConfig[]
  addVisualization: (visualization: VisualizationConfig) => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<any>(null)
  const [summary, setSummary] = useState<string>("")
  const [visualizations, setVisualizations] = useState<VisualizationConfig[]>([])

  const addVisualization = (visualization: VisualizationConfig) => {
    setVisualizations((prev) => [...prev, visualization])
  }

  return (
    <DataContext.Provider
      value={{
        data,
        setData,
        summary,
        setSummary,
        visualizations,
        addVisualization,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
