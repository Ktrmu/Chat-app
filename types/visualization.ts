export interface ChartData {
  labels: string[]
  values: number[]
  datasetLabel?: string
}

export interface VisualizationConfig {
  type: "bar" | "line" | "pie" | "donut"
  title: string
  description: string
  data: ChartData
}
