"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Send, Bot, User, Loader2, Globe } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  language: string
}

interface AIChatDialogProps {
  isOpen: boolean
  onClose: () => void
  webhookUrl?: string
  onError?: (error: Error) => void
}

export default function AIChatDialog({ isOpen, onClose, webhookUrl, onError }: AIChatDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  // --- безопасные значения языка, чтобы нигде не было undefined ---
  const languageCode = currentLanguage?.code || "en"

  const languageName =
    currentLanguage?.name ||
    (languageCode === "ru" ? "Русский" : languageCode === "uk" ? "Українська" : "English")

  const languageFlag = currentLanguage?.flag || "🇬🇧"

  const effectiveWebhookUrl =
    webhookUrl ||
    process.env.NEXT_PUBLIC_N8N_CHAT_WEBHOOK_URL ||
    "https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59"

  // --- состояние ---
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  // refs
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastLanguageRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // фокус при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // создаём приветствие каждый раз, когда:
  // - чат только что открылся
  // - сменился язык
  useEffect(() => {
    if (!isOpen) return

    const languageChanged = lastLanguageRef.current && lastLanguageRef.current !== languageCode

    if (messages.length === 0 || languageChanged) {
      const greetings: Record<string, string> = {
        en: "Hello! I'm your AI psychologist. How can I help you today?",
        ru: "Здравствуйте! Я ваш ИИ-психолог. Как я могу помочь вам сегодня?",
        uk: "Вітаю! Я ваш ШІ-психолог. Як я можу допомогти вам сьогодні?",
      }

      const greeting = greetings[languageCode] || greetings.en

      const initialMessage: Message = {
        id: `initial-${languageCode}`,
        content: greeting,
        sender: "ai",
        timestamp: new Date(),
        language: languageCode,
      }

      setMessages([initialMessage])
      lastLanguageRef.current = languageCode
    }
  }, [isOpen, languageCode]) // специально без messages в зависимостях

  // обработка сообщения
  const processMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      setIsLoading(true)
      setIsTyping(true)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const params = new URLSearchParams({
          text: message,
          language: languageCode,
          user: user?.email || "guest@example.com",
        })

        const response = await fetch(`${effectiveWebhookUrl}?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) throw new Error(`Webhook error: ${response.status}`)

        const contentType = response.headers.get("content-type")
        let data: any

        if (contentType && contentType.includes("application/json")) {
          data = await response.json()
        } else {
          const text = await response.text()
          try {
            data = JSON.parse(text)
          } catch {
            data = { response: text }
          }
        }

        let aiText = ""

        if (typeof data === "string") {
          aiText = data
        } else if (Array.isArray(data) && data.length > 0) {
          const first = data[0]
          aiText =
            first.output || first.response || first.text || first.message || first.content || JSON.stringify(first)
        } else if (data && typeof data === "object") {
          aiText =
            data.response ||
            data.text ||
            data.message ||
            data.output ||
            data.content ||
            data.result ||
            JSON.stringify(data)
        }

        const cleaned = aiText
          .replace(/^\s*[{[]|\s*[}\]]$/g, "")
          .replace(/"output":|"response":|"text":|"message":/g, "")
          .replace(/["{}[\],]/g, "")
          .replace(/\s+/g, " ")
          .trim()

        if (!cleaned) throw new Error("Empty response")

        const aiMessage: Message = {
          id: `${Date.now()}-ai`,
          content: cleaned,
          sender: "ai",
          timestamp: new Date(),
          language: languageCode,
        }

        setMessages((prev) => [...prev, aiMessage])
      } catch (error: any) {
        console.error("Chat error:", error)
        const msg =
          error?.name === "AbortError"
            ? t("Connection timeout. Please try again.")
            : t("I'm sorry, I couldn't process your message. Please try again.")

        const errMessage: Message = {
          id: `${Date.now()}-error`,
          content: msg,
          sender: "ai",
          timestamp: new Date(),
          language: languageCode,
        }

        setMessages((prev) => [...prev, errMessage])
        onError?.(error)
      } finally {
        setIsLoading(false)
        setIsTyping(false)
      }
    },
    [effectiveWebhookUrl, languageCode, user?.email, t, onError],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isLoading) return

      const msgText = inputValue.trim()

      const userMessage: Message = {
        id: `${Date.now()}-user`,
        content: msgText,
        sender: "user",
        timestamp: new Date(),
        language: languageCode,
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue("")
      await processMessage(msgText)
    },
    [inputValue, isLoading, languageCode, processMessage],
  )

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as any)
      }
    },
    [handleSubmit],
  )

  const formatTime = useCallback(
    (date: Date) =>
      date.toLocaleTimeString(languageCode === "uk" ? "uk-UA" : languageCode === "ru" ? "ru-RU" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [languageCode],
  )

  if (!isOpen) return null

  const guestLabels: Record<string, string> = {
    en: "Guest (not signed in)",
    ru: "Гость (без входа)",
    uk: "Гість (без входу)",
  }

  const userEmail = user?.email || guestLabels[languageCode] || guestLabels.en

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">AI Psychologist Chat</h3>
            <div className="text-xs text-lavender-200">
              User: {userEmail}
            </div>
            <div className="text-xs text-lavender-200 mt-1 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              Language: {languageName} {languageFlag}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-primary-700">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Info strip */}
        <div className="px-4 py-2 bg-blue-50 border-b">
          <p className="text-sm text-blue-700 text-center">
            Chat communication in {languageName} • AI will understand and respond in this language
          </p>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[80%] ${
                    message.sender === "user" ? "flex-row-reverse" : "flex-row"
                  } items-start space-x-2`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sender === "user" ? "bg-primary-600 text-white ml-2" : "bg-gray-200 text-gray-600 mr-2"
                    }`}
                  >
                    {message.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.sender === "user" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${message.sender === "user" ? "text-primary-200" : "text-gray-500"}`}>
                        {formatTime(message.timestamp)}
                      </p>
                      <span
                        className={`text-xs ml-2 px-1 py-0.5 rounded ${
                          message.sender === "user" ? "bg-primary-700 text-primary-200" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {message.language.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center mr-2">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-gray-50">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Type your message in ${languageName}...`}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send • AI responds in {languageName}
          </p>
        </div>
      </div>
    </div>
  )
}
