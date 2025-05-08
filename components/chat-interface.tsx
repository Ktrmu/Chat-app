"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useData } from "@/context/data-context"
import { generateResponse } from "@/lib/generate-response"
import { generateVisualization } from "@/lib/generate-visualization"

interface ChatInterfaceProps {
  onVisualizationCreated: () => void
}

interface Message {
  role: "user" | "assistant"
  content: string
}

export function ChatInterface({ onVisualizationCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, summary, addVisualization } = useData()

  // Add initial message with data summary
  useEffect(() => {
    if (summary) {
      setMessages([
        {
          role: "assistant",
          content: `I've analyzed your data. Here's a summary:\n\n${summary}\n\nYou can ask me questions about your data or request visualizations.`,
        },
      ])
    }
  }, [summary])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      // Check if the message is requesting a visualization
      const isVisualizationRequest =
        userMessage.toLowerCase().includes("chart") ||
        userMessage.toLowerCase().includes("graph") ||
        userMessage.toLowerCase().includes("plot") ||
        userMessage.toLowerCase().includes("visualize") ||
        userMessage.toLowerCase().includes("visualization")

      if (isVisualizationRequest) {
        // Generate visualization
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I'll create a visualization based on your request. Please wait a moment...",
          },
        ])

        const visualizationConfig = await generateVisualization(userMessage, data)
        addVisualization(visualizationConfig)

        setMessages((prev) => [
          ...prev.slice(0, -1), // Remove the "creating visualization" message
          {
            role: "assistant",
            content: "I've created a visualization based on your request. You can view it in the Dashboard tab.",
          },
        ])

        onVisualizationCreated()
      } else {
        // Generate text response
        const response = await generateResponse(userMessage, data)
        setMessages((prev) => [...prev, { role: "assistant", content: response }])
      }
    } catch (error) {
      console.error("Error generating response:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I encountered an error while processing your request. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
      // Focus the input field after response
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chat with your data</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[80%] items-start space-x-2 rounded-lg px-3 py-2 ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <div className="mt-0.5">
                    {message.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[80%] items-center space-x-2 rounded-lg bg-muted px-3 py-2">
                  <Bot className="h-5 w-5" />
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Input
            ref={inputRef}
            placeholder="Ask a question about your data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
