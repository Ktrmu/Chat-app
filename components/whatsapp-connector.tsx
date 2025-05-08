"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useData } from "@/context/data-context"
import { MessageSquare, Phone } from "lucide-react"

export function WhatsAppConnector() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [twilioAccountSid, setTwilioAccountSid] = useState("")
  const [twilioAuthToken, setTwilioAuthToken] = useState("")
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const { toast } = useToast()
  const { data } = useData()

  const handleConnect = async () => {
    if (!phoneNumber) {
      toast({
        title: "Missing Phone Number",
        description: "Please enter your WhatsApp phone number.",
        variant: "destructive",
      })
      return
    }

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      toast({
        title: "Missing Twilio Credentials",
        description: "Please enter your Twilio account details.",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)

    try {
      // In a real implementation, we would validate the Twilio credentials
      // For now, we'll just simulate a successful connection

      // If we have data, associate it with this phone number
      if (data) {
        await fetch("/api/whatsapp", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber,
            data,
          }),
        })
      }

      setIsConnected(true)
      toast({
        title: "WhatsApp Connected",
        description: "You can now interact with your data via WhatsApp!",
      })
    } catch (error) {
      console.error("Error connecting WhatsApp:", error)
      toast({
        title: "Connection Error",
        description: "Failed to connect WhatsApp. Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>WhatsApp Integration</CardTitle>
        <CardDescription>Connect your WhatsApp to interact with your data on the go</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone-number">Your WhatsApp Phone Number</Label>
          <Input
            id="phone-number"
            placeholder="+1234567890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isConnected}
          />
          <p className="text-xs text-muted-foreground">Include country code (e.g., +1 for US)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="twilio-sid">Twilio Account SID</Label>
          <Input
            id="twilio-sid"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={twilioAccountSid}
            onChange={(e) => setTwilioAccountSid(e.target.value)}
            disabled={isConnected}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="twilio-token">Twilio Auth Token</Label>
          <Input
            id="twilio-token"
            type="password"
            placeholder="Your Twilio Auth Token"
            value={twilioAuthToken}
            onChange={(e) => setTwilioAuthToken(e.target.value)}
            disabled={isConnected}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="twilio-phone">Twilio WhatsApp Number</Label>
          <Input
            id="twilio-phone"
            placeholder="+1234567890"
            value={twilioPhoneNumber}
            onChange={(e) => setTwilioPhoneNumber(e.target.value)}
            disabled={isConnected}
          />
        </div>

        {isConnected ? (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-300">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <p className="font-medium">WhatsApp Connected</p>
            </div>
            <p className="mt-1 text-xs">
              You can now send messages to {twilioPhoneNumber} to interact with your data. Try asking questions or
              requesting visualizations!
            </p>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={isConnecting || isConnected} className="w-full">
            {isConnecting ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>Connect WhatsApp</span>
              </div>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Note: You need a Twilio account with WhatsApp Business API access to use this feature.
          <a
            href="https://www.twilio.com/whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            className="underline ml-1"
          >
            Learn more
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
