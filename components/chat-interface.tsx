"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Sparkles, Clock, Copy, Info, HelpCircle, AlertTriangle, BarChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/context/data-context"
import { generateResponse } from "@/lib/generate-response"
import { generateVisualization } from "@/lib/generate-visualization"
import { useToast } from "@/components/ui/use-toast"

interface ChatInterfaceProps {
  onVisualizationCreated: () => void
}

interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

export function ChatInterface({ onVisualizationCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitTimer, setRateLimitTimer] = useState(0)
  const [visualizationAttempts, setVisualizationAttempts] = useState(0)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { data, summary, addVisualization, visualizations } = useData()
  const { toast } = useToast()

  // Add initial message with data summary
  useEffect(() => {
    if (summary) {
      setMessages([
        {
          role: "assistant",
          content: `I've analyzed your data. Here's a summary:\n\n${summary}\n\nYou can ask me questions about your data or request visualizations.`,
          timestamp: new Date(),
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

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearInterval(rateLimitTimerRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isRateLimited) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: new Date() }])
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
            timestamp: new Date(),
          },
        ])

        try {
          // Track visualization attempts to prevent infinite loops
          setVisualizationAttempts((prev) => prev + 1)

          // If we've tried too many times, use a simpler approach
          if (visualizationAttempts >= 2) {
            // Use an existing visualization if available
            if (visualizations.length > 0) {
              const existingViz = visualizations[0]
              setMessages((prev) => [
                ...prev.slice(0, -1), // Remove the "creating visualization" message
                {
                  role: "assistant",
                  content: `I'm having trouble creating a new visualization, but I can show you an existing one. I've selected a **${existingViz.type} chart** titled "${existingViz.title}".\n\nYou can view it in the Dashboard tab.`,
                  timestamp: new Date(),
                },
              ])
              onVisualizationCreated()
              return
            }
          }

          const visualizationConfig = await generateVisualization(userMessage, data)
          addVisualization(visualizationConfig)

          setMessages((prev) => [
            ...prev.slice(0, -1), // Remove the "creating visualization" message
            {
              role: "assistant",
              content: `✅ I've created a **${visualizationConfig.type} chart** titled "${visualizationConfig.title}".\n\nYou can view it in the Dashboard tab. The visualization shows ${visualizationConfig.description.toLowerCase()}`,
              timestamp: new Date(),
            },
          ])

          toast({
            title: "Visualization Created",
            description: `Created a ${visualizationConfig.type} chart: ${visualizationConfig.title}`,
          })

          onVisualizationCreated()

          // Reset visualization attempts counter on success
          setVisualizationAttempts(0)
        } catch (vizError) {
          console.error("Error generating visualization:", vizError)

          // If visualization generation failed, try to respond with text instead
          setMessages((prev) => [
            ...prev.slice(0, -1), // Remove the "creating visualization" message
            {
              role: "assistant",
              content: "I'm having trouble creating that visualization. Let me describe the data instead.",
              timestamp: new Date(),
            },
          ])

          // Generate a text response as fallback
          try {
            const response = await generateResponse(userMessage, data)
            setMessages((prev) => [...prev, { role: "assistant", content: response, timestamp: new Date() }])
          } catch (textError) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "I'm sorry, I encountered an error while processing your request. Please try a different question or simplify your visualization request.",
                timestamp: new Date(),
              },
            ])
          }
        }
      } else {
        // Generate text response
        const response = await generateResponse(userMessage, data)
        setMessages((prev) => [...prev, { role: "assistant", content: response, timestamp: new Date() }])
      }
    } catch (error: any) {
      console.error("Error generating response:", error)

      // Check if it's a rate limit error
      if (error.message && error.message.includes("Rate limit reached")) {
        // Extract the suggested wait time if available
        const waitTimeMatch = error.message.match(/Please try again in (\d+\.\d+)s/)
        const waitTime = waitTimeMatch ? Math.ceil(Number.parseFloat(waitTimeMatch[1])) : 10

        setIsRateLimited(true)
        setRateLimitTimer(waitTime)

        // Add a system message about rate limiting
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `Rate limit reached. Please wait ${waitTime} seconds before sending another message.`,
            timestamp: new Date(),
          },
        ])

        // Start countdown timer
        let timeLeft = waitTime
        rateLimitTimerRef.current = setInterval(() => {
          timeLeft -= 1
          setRateLimitTimer(timeLeft)

          if (timeLeft <= 0) {
            setIsRateLimited(false)
            if (rateLimitTimerRef.current) {
              clearInterval(rateLimitTimerRef.current)
            }
          }
        }, 1000)
      } else {
        // For other errors
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I'm sorry, I encountered an error while processing your request. Please try again with a simpler question.",
            timestamp: new Date(),
          },
        ])
      }
    } finally {
      setIsLoading(false)
      // Focus the input field after response
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const copyMessageToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
    toast({
      title: "Copied to clipboard",
      description: "Message content copied to clipboard",
      duration: 2000,
    })
  }

  // Suggested questions for the user
  const suggestedQuestions = [
    "What are the key trends in this data?",
    "Create a bar chart of the top indicators",
    "Summarize the main findings",
    "Show a pie chart of distribution by category",
  ]

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 bg-card dark:bg-card text-card-foreground dark:text-card-foreground">
        <CardTitle className="flex items-center gap-2 text-foreground dark:text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Chat with your data
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <HelpCircle className="h-4 w-4" />
                <span className="sr-only">Help</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-sm">
              <p>
                Ask questions about your data or request visualizations. Try phrases like "Show me a chart of..." or
                "What are the trends in..."
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-4 bg-background dark:bg-background">
        <ScrollArea className="h-[450px] pr-4 rounded-lg border" ref={scrollAreaRef}>
          <div className="space-y-4 p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`group flex ${
                  message.role === "user"
                    ? "justify-end"
                    : message.role === "system"
                      ? "justify-center"
                      : "justify-start"
                } mb-4`}
              >
                {message.role === "system" ? (
                  <div className="flex items-center space-x-2 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-4 py-2 max-w-[85%]">
                    <AlertTriangle className="h-4 w-4" />
                    <div className="text-sm">{message.content}</div>
                  </div>
                ) : (
                  <div
                    className={`flex max-w-[85%] items-start space-x-2 rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted dark:bg-muted/70 border border-border"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {message.role === "user" ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                          <User className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                          <Bot className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="whitespace-pre-wrap text-sm prose dark:prose-invert max-w-none text-foreground dark:text-foreground">
                        {formatMessageContent(message.content)}
                      </div>
                      <div
                        className={`mt-2 flex items-center text-xs ${
                          message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        {formatTimestamp(message.timestamp)}

                        {message.role === "assistant" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyMessageToClipboard(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                            <span className="sr-only">Copy</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] items-center space-x-2 rounded-2xl bg-muted dark:bg-muted/70 border border-border px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex space-x-2">
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

        {/* Rate limit warning */}
        {isRateLimited && (
          <div className="mt-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Rate limit reached. Please wait {rateLimitTimer} seconds before sending another message.</span>
          </div>
        )}

        {/* Visualization suggestion */}
        {visualizations.length > 0 && messages.length > 2 && !isRateLimited && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-md flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>
              You have {visualizations.length} visualization{visualizations.length !== 1 ? "s" : ""} available in the
              Dashboard tab.
            </span>
          </div>
        )}

        {/* Suggested questions */}
        {messages.length <= 2 && !isRateLimited && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Suggested questions:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs text-foreground dark:text-foreground"
                  onClick={() => {
                    setInput(question)
                    inputRef.current?.focus()
                  }}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t bg-muted/50 p-4">
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Input
            ref={inputRef}
            placeholder={isRateLimited ? `Please wait ${rateLimitTimer}s...` : "Ask a question about your data..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isRateLimited}
            className="flex-1 border-muted-foreground/20"
          />
          <Button type="submit" size="icon" disabled={isLoading || isRateLimited || !input.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

// Helper function to format message content with markdown-like syntax
function formatMessageContent(content: string): React.ReactNode {
  if (!content) return null

  // Split by newlines to handle paragraphs
  const paragraphs = content.split("\n\n")

  return (
    <>
      {paragraphs.map((paragraph, i) => {
        // Handle bold text
        const boldPattern = /\*\*(.*?)\*\*/g
        const textWithBold = paragraph.split(boldPattern)

        // Handle bullet points
        if (paragraph.trim().startsWith("• ") || paragraph.trim().startsWith("- ")) {
          const items = paragraph
            .split(/[•-]\s+/)
            .filter(Boolean)
            .map((item) => item.trim())

          return (
            <ul key={i} className="list-disc pl-5 my-2 space-y-1 text-foreground dark:text-foreground">
              {items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )
        }

        // Handle headings (lines ending with colon)
        if (/^[A-Z][A-Za-z\s]+:/.test(paragraph)) {
          const [heading, ...rest] = paragraph.split(":")
          return (
            <div key={i} className="my-2 text-foreground dark:text-foreground">
              <strong className="text-sm font-semibold">{heading}:</strong>
              <span>{rest.join(":")}</span>
            </div>
          )
        }

        // Render paragraph with bold formatting
        return (
          <p key={i} className="my-1 text-foreground dark:text-foreground">
            {textWithBold.map((text, j) => {
              // Even indices are regular text, odd indices are bold text
              return j % 2 === 0 ? (
                <span key={j}>{text}</span>
              ) : (
                <strong key={j} className="font-semibold">
                  {text}
                </strong>
              )
            })}
          </p>
        )
      })}
    </>
  )
}

// Helper function to format timestamp
function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) {
    return "just now"
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 24 * 60) {
    return `${Math.floor(diffInMinutes / 60)}h ago`
  } else {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
}
