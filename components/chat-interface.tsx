"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Bot,
  User,
  Sparkles,
  Clock,
  Copy,
  Info,
  HelpCircle,
  AlertTriangle,
  BarChart,
  History,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/context/data-context"
import { generateResponse } from "@/lib/generate-response"
import { generateVisualization } from "@/lib/generate-visualization"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

interface ChatInterfaceProps {
  onVisualizationCreated: () => void
}

interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  lastUpdated: Date
  dataHash: string // To associate chat with specific data
}

export function ChatInterface({ onVisualizationCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitTimer, setRateLimitTimer] = useState(0)
  const [visualizationAttempts, setVisualizationAttempts] = useState(0)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { data, summary, addVisualization, visualizations } = useData()
  const { toast } = useToast()

  // Generate a simple hash for the data to identify it
  const getDataHash = (data: any): string => {
    if (!data) return "no-data"
    const str = typeof data === "string" ? data : JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(16)
  }

  const dataHash = getDataHash(data)

  // Load chat sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem("chatSessions")
    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions) as ChatSession[]
        // Convert string dates back to Date objects
        sessions.forEach((session) => {
          session.lastUpdated = new Date(session.lastUpdated)
          session.messages.forEach((msg) => {
            msg.timestamp = new Date(msg.timestamp)
          })
        })
        setChatSessions(sessions)

        // Find a session for the current data
        const matchingSession = sessions.find((s) => s.dataHash === dataHash)
        if (matchingSession) {
          setCurrentSessionId(matchingSession.id)
          setMessages(matchingSession.messages)
        }
      } catch (error) {
        console.error("Error loading chat sessions:", error)
      }
    }
  }, [dataHash])

  // Add initial message with data summary
  useEffect(() => {
    if (summary && messages.length === 0) {
      const initialMessage = {
        role: "assistant" as const,
        content: `I've analyzed your data. Here's a summary:\n\n${summary}\n\nYou can ask me questions about your data or request visualizations.`,
        timestamp: new Date(),
      }

      setMessages([initialMessage])

      // Create a new session if we don't have one for this data
      if (!currentSessionId) {
        const newSessionId = `session_${Date.now()}`
        const newSession: ChatSession = {
          id: newSessionId,
          title: "Data Analysis Session",
          messages: [initialMessage],
          lastUpdated: new Date(),
          dataHash,
        }

        setChatSessions((prev) => [...prev, newSession])
        setCurrentSessionId(newSessionId)

        // Save to localStorage
        localStorage.setItem("chatSessions", JSON.stringify([...chatSessions, newSession]))
      }
    }
  }, [summary, messages.length, currentSessionId, dataHash, chatSessions])

  // Save messages to localStorage when they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setChatSessions((prev) => {
        const updated = prev.map((session) => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages,
              lastUpdated: new Date(),
            }
          }
          return session
        })

        // Save to localStorage
        localStorage.setItem("chatSessions", JSON.stringify(updated))
        return updated
      })
    }
  }, [messages, currentSessionId])

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

  const loadChatSession = (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId)
    if (session) {
      setMessages(session.messages)
      setCurrentSessionId(sessionId)
      setShowHistory(false)
    }
  }

  const startNewChat = () => {
    // Create a new session
    const newSessionId = `session_${Date.now()}`
    const initialMessage = {
      role: "assistant" as const,
      content: `I've analyzed your data. Here's a summary:\n\n${summary}\n\nYou can ask me questions about your data or request visualizations.`,
      timestamp: new Date(),
    }

    const newSession: ChatSession = {
      id: newSessionId,
      title: `Chat Session ${chatSessions.length + 1}`,
      messages: [initialMessage],
      lastUpdated: new Date(),
      dataHash,
    }

    setChatSessions((prev) => [...prev, newSession])
    setCurrentSessionId(newSessionId)
    setMessages([initialMessage])

    // Save to localStorage
    localStorage.setItem("chatSessions", JSON.stringify([...chatSessions, newSession]))
    setShowHistory(false)
  }

  const clearChatHistory = () => {
    // Filter out sessions with the current data hash
    const updatedSessions = chatSessions.filter((session) => session.dataHash !== dataHash)
    setChatSessions(updatedSessions)
    localStorage.setItem("chatSessions", JSON.stringify(updatedSessions))

    // Reset current session
    setCurrentSessionId(null)

    // Add initial message with data summary
    const initialMessage = {
      role: "assistant" as const,
      content: `I've analyzed your data. Here's a summary:\n\n${summary}\n\nYou can ask me questions about your data or request visualizations.`,
      timestamp: new Date(),
    }
    setMessages([initialMessage])

    // Create a new session
    const newSessionId = `session_${Date.now()}`
    const newSession: ChatSession = {
      id: newSessionId,
      title: "Data Analysis Session",
      messages: [initialMessage],
      lastUpdated: new Date(),
      dataHash,
    }

    setChatSessions((prev) => [...prev.filter((s) => s.dataHash !== dataHash), newSession])
    setCurrentSessionId(newSessionId)

    // Save to localStorage
    localStorage.setItem("chatSessions", JSON.stringify([...updatedSessions, newSession]))

    toast({
      title: "Chat history cleared",
      description: "All chat history for this dataset has been cleared",
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

  // Filter sessions for the current data
  const currentDataSessions = chatSessions.filter((session) => session.dataHash === dataHash)

  return (
    <Card className="w-full shadow-md border-2">
      <CardHeader className="flex flex-row items-center justify-between py-4 px-6 space-y-0 bg-primary/5 dark:bg-primary/10 border-b">
        <CardTitle className="flex items-center gap-2 text-foreground dark:text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Chat with your data
        </CardTitle>
        <div className="flex items-center gap-2">
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Chat History</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Chat History</DialogTitle>
                <DialogDescription>View and load previous chat sessions for this dataset.</DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {currentDataSessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No chat history found for this dataset.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {currentDataSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-md border cursor-pointer hover:bg-muted transition-colors ${
                          session.id === currentSessionId ? "bg-primary/10 border-primary/30" : "bg-card"
                        }`}
                        onClick={() => loadChatSession(session.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{session.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(session.lastUpdated).toLocaleDateString()} at{" "}
                            {new Date(session.lastUpdated).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {session.messages[session.messages.length - 1]?.content.substring(0, 60)}...
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button variant="destructive" size="sm" onClick={clearChatHistory} className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear History
                </Button>
                <div>
                  <Button variant="outline" size="sm" onClick={startNewChat} className="mr-2">
                    New Chat
                  </Button>
                  <DialogClose asChild>
                    <Button size="sm">Close</Button>
                  </DialogClose>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
        </div>
      </CardHeader>
      <CardContent className="p-4 bg-background dark:bg-background">
        <ScrollArea
          className="h-[550px] pr-4 rounded-lg border bg-background/50 shadow-inner chat-scroll-area"
          ref={scrollAreaRef}
        >
          <div className="space-y-6 p-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`group flex chat-message-container ${
                  message.role === "user"
                    ? "justify-end"
                    : message.role === "system"
                      ? "justify-center"
                      : "justify-start"
                } mb-4 ${index === messages.length - 1 ? "new-message" : ""}`}
              >
                {message.role === "system" ? (
                  <div className="flex items-center space-x-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-5 py-3 max-w-[85%] border border-amber-200 dark:border-amber-800/30 shadow-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <div className="text-sm">{message.content}</div>
                  </div>
                ) : (
                  <div
                    className={`flex max-w-[85%] items-start space-x-3 rounded-2xl px-5 py-4 shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card dark:bg-card/90 border-2 border-border"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {message.role === "user" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20 border border-primary/20 shadow-sm">
                          <User className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary shadow-sm">
                          <Bot className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col w-full">
                      <div className="whitespace-pre-wrap text-base prose dark:prose-invert max-w-none text-foreground dark:text-foreground leading-relaxed">
                        {formatMessageContent(message.content)}
                      </div>
                      <div
                        className={`mt-3 flex items-center text-xs font-medium ${
                          message.role === "user" ? "text-primary-foreground/80" : "text-muted-foreground"
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
                <div className="flex max-w-[85%] items-center space-x-3 rounded-2xl bg-card dark:bg-card/90 border-2 border-border px-5 py-4 shadow-sm">
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
          <div className="mt-4 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 p-4 rounded-md flex items-center gap-3 border border-amber-200 dark:border-amber-800/30 shadow-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Rate limit reached. Please wait {rateLimitTimer} seconds before sending another message.</span>
          </div>
        )}

        {/* Visualization suggestion */}
        {visualizations.length > 0 && messages.length > 2 && !isRateLimited && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-4 rounded-md flex items-center gap-3 border border-blue-200 dark:border-blue-800/30 shadow-sm">
            <BarChart className="h-4 w-4" />
            <span>
              You have {visualizations.length} visualization{visualizations.length !== 1 ? "s" : ""} available in the
              Dashboard tab.
            </span>
          </div>
        )}

        {/* Suggested questions */}
        {messages.length <= 2 && !isRateLimited && (
          <div className="mt-6 bg-muted/30 p-4 rounded-lg border">
            <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Suggested questions:
            </p>
            <div className="flex flex-wrap gap-3">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-sm text-foreground dark:text-foreground border-2 hover:bg-muted/50 hover:text-primary"
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
      <CardFooter className="border-t bg-card p-5">
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Input
            ref={inputRef}
            placeholder={isRateLimited ? `Please wait ${rateLimitTimer}s...` : "Ask a question about your data..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isRateLimited}
            className="flex-1 border-2 border-muted-foreground/20 py-6 px-4 text-base shadow-sm focus-visible:ring-primary chat-input"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || isRateLimited || !input.trim()}
            className="h-12 w-12 rounded-full shadow-sm"
          >
            <Send className="h-5 w-5" />
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
        // Handle code blocks
        if (paragraph.includes("```")) {
          const parts = paragraph.split(/(```(?:[\w-]+)?\n[\s\S]*?\n```)/g)
          return (
            <div key={i} className="w-full my-2">
              {parts.map((part, j) => {
                if (part.startsWith("```") && part.endsWith("```")) {
                  // Extract language and code
                  const match = part.match(/```([\w-]+)?\n([\s\S]*?)\n```/)
                  const language = match?.[1] || ""
                  const code = match?.[2] || part.slice(3, -3).trim()

                  return (
                    <div key={j} className="relative w-full my-2 overflow-x-auto">
                      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 text-white px-4 py-1 text-xs rounded-t-md">
                        <span>{language || "code"}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-white hover:bg-gray-700"
                          onClick={() => navigator.clipboard.writeText(code)}
                        >
                          <Copy className="h-3 w-3" />
                          <span className="sr-only">Copy code</span>
                        </Button>
                      </div>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-b-md overflow-x-auto text-xs text-gray-800 dark:text-gray-200 w-full">
                        <code className="font-mono">{code}</code>
                      </pre>
                    </div>
                  )
                }

                // Process non-code parts
                return processTextParagraph(part, j)
              })}
            </div>
          )
        }

        // Handle bullet points
        if (paragraph.trim().startsWith("• ") || paragraph.trim().startsWith("- ")) {
          const items = paragraph
            .split(/[•-]\s+/)
            .filter(Boolean)
            .map((item) => item.trim())

          return (
            <ul key={i} className="list-disc pl-5 my-2 space-y-1 text-foreground dark:text-foreground">
              {items.map((item, j) => (
                <li key={j}>{highlightNumbers(item)}</li>
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
              <span>{highlightNumbers(rest.join(":"))}</span>
            </div>
          )
        }

        // Regular paragraph
        return processTextParagraph(paragraph, i)
      })}
    </>
  )
}

// Helper function to process a text paragraph with bold formatting
function processTextParagraph(paragraph: string, key: number): React.ReactNode {
  // Handle bold text
  const boldPattern = /\*\*(.*?)\*\*/g
  const textWithBold = paragraph.split(boldPattern)

  return (
    <p key={key} className="my-2 text-foreground dark:text-foreground">
      {textWithBold.map((text, j) => {
        // Even indices are regular text, odd indices are bold text
        return j % 2 === 0 ? (
          <span key={j}>{highlightNumbers(text)}</span>
        ) : (
          <strong key={j} className="font-semibold text-primary">
            {highlightNumbers(text)}
          </strong>
        )
      })}
    </p>
  )
}

// Function to highlight numbers in text
function highlightNumbers(text: string): React.ReactNode {
  // Split by numbers with optional % sign
  const parts = text.split(/(\b\d+(\.\d+)?%?\b)/g)

  return parts.map((part, i) => {
    // If it's a number (with optional % sign), highlight it
    if (/^\d+(\.\d+)?%?$/.test(part)) {
      return (
        <span key={i} className="font-bold text-primary">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
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
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " at " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    )
  }
}
