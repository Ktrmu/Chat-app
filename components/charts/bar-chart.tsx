"use client"

import { useEffect, useRef } from "react"
import { Chart, registerables } from "chart.js"
import type { ChartData } from "@/types/visualization"

Chart.register(...registerables)

interface BarChartProps {
  data: ChartData
}

export function BarChart({ data }: BarChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    const ctx = chartRef.current.getContext("2d")
    if (!ctx) return

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: data.datasetLabel || "Value",
            data: data.values,
            backgroundColor: [
              "rgba(59, 130, 246, 0.5)",
              "rgba(16, 185, 129, 0.5)",
              "rgba(249, 115, 22, 0.5)",
              "rgba(217, 70, 239, 0.5)",
              "rgba(234, 179, 8, 0.5)",
              "rgba(6, 182, 212, 0.5)",
              "rgba(236, 72, 153, 0.5)",
            ],
            borderColor: [
              "rgb(59, 130, 246)",
              "rgb(16, 185, 129)",
              "rgb(249, 115, 22)",
              "rgb(217, 70, 239)",
              "rgb(234, 179, 8)",
              "rgb(6, 182, 212)",
              "rgb(236, 72, 153)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [data])

  return <canvas ref={chartRef} />
}
