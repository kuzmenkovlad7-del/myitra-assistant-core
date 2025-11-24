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

// URL вебхука берём из .env, хардкод оставляем как fallback на случай,
// если переменную забыли прописать
const FALLBACK_WEBHOOK_URL =
  "https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59"

const CHAT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_WEBHOOK_URL || FALLBACK_WEBHOOK_URL

export default function AIChatDialog({
  isOpen,
  onClose,
  webhookUrl,
  onError,
}: AIChatDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // только 3 языка: uk, ru, en
  const greetings: Record<string, string> = {
    en: "Hello! I'm your AI psychologist. How can I help you today?",
    ru: "Здравствуйте! Я ваш ИИ-психолог. Как я могу помочь вам сегодня?",
    uk: "Вітаю! Я ваш ШІ-психолог. Як я можу допомогти вам сьогодні?",
  }

  const guestLabels: Record<string, string> = {
    en: "Guest (not signed in)",
    ru: "Гость (без входа)",
    uk: "Гість (без входу)",
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // стартовое приветствие на выбранном языке
  useEffect(() => {
    if (!isOpen) return
    if (messages.length > 0) return

    const code = currentLanguage.code as "en" | "ru" | "uk"
    const greeting = greetings[code] || greetings.en

    const initialMessage: Message = {
      id: "initial",
      content: greeting,
      sender: "ai",
      timestamp: new Date(),
      language: code,
    }

    setMessages([initialMessage])
  }, [isOpen, messages.length, currentLanguage.code])

  const processMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      const url = webhookUrl || CHAT_WEBHOOK_URL
      if (!url) {
        const error = new Error("Webhook URL is not configured")
        onError?.(error)
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString() + "-error",
            content: t("I'm sorry, the service is temporarily unavailable. Please try again later."),
            sender: "ai",
            timestamp: new Date(),
            language: currentLanguage.code,
          },
        ])
        return
      }

      setIsLoading(true)
      setIsTyping(true)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const params = new URLSearchParams({
          text: message,
          language: currentLanguage.code,
          user: user?.email || "guest@example.com",
        })

        const webhookResponse = await fetch(`${url}?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          throw new Error(`Webhook error: ${webhookResponse.status}`)
        }

        let responseData: any
        const contentType = webhookResponse.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          responseData = await webhookResponse.json()
        } else {
          const textResponse = await webhookResponse.text()
          try {
            responseData = JSON.parse(textResponse)
          } catch {
            responseData = { response: textResponse }
          }
        }

        let aiResponseText = ""

        if (typeof responseData === "string") {
          aiResponseText = responseData
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          const firstItem = responseData[0]
          aiResponseText =
            firstItem.output ||
            firstItem.response ||
            firstItem.text ||
            firstItem.message ||
            JSON.stringify(firstItem)
        } else if (responseData && typeof responseData === "object") {
          aiResponseText =
            responseData.response ||
            responseData.text ||
            responseData.message ||
            responseData.output ||
            responseData.content ||
            responseData.result ||
            JSON.stringify(responseData)
        }

        const cleanedResponse = aiResponseText
          .replace(/^\s*[{[]|\s*[}\]]$/g, "")
          .replace(/"output":|"response":|"text":|"message":/g, "")
          .replace(/["{}[\],]/g, "")
          .replace(/\s+/g, " ")
          .trim()

        if (!cleanedResponse) {
          throw new Error("Empty response received")
        }

        const aiMessage: Message = {
          id: Date.now().toString() + "-ai",
          content: cleanedResponse,
          sender: "ai",
          timestamp: new Date(),
          language: currentLanguage.code,
        }

        setMessages(prev => [...prev, aiMessage])
      } catch (error: any) {
        console.error("Error processing chat message:", error)

        const errorMessage =
          error?.name === "AbortError"
            ? t("Connection timeout. Please try again.")
            : t("I'm sorry, I couldn't process your message. Please try again.")

        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString() + "-error",
            content: errorMessage,
            sender: "ai",
            timestamp: new Date(),
            language: currentLanguage.code,
          },
        ])

        onError?.(error)
      } finally {
        setIsLoading(false)
        setIsTyping(false)
      }
    },
    [currentLanguage.code, t, user?.email, webhookUrl, onError],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isLoading) return

      const userMessage: Message = {
        id: Date.now().toString() + "-user",
        content: inputValue.trim(),
        sender: "user",
        timestamp: new Date(),
        language: currentLanguage.code,
      }

      setMessages(prev => [...prev, userMessage])

      const messageToProcess = inputValue.trim()
      setInputValue("")
      await processMessage(messageToProcess)
    },
    [inputValue, isLoading, currentLanguage.code, processMessage],
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
      date.toLocaleTimeString(currentLanguage.code, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [currentLanguage.code],
  )

  if (!isOpen) return null

  const userEmail =
    user?.email ||
    guestLabels[currentLanguage.code as "en" | "ru" | "uk"] ||
    guestLabels.en

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-900 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">{t("AI Psychologist Chat")}</h3>
            <div className="text-xs text-slate-200">
              {t("User")}: {userEmail}
            </div>
            <div className="text-xs text-slate-200 mt-1 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-blue-50 border-b">
          <p className="text-sm text-blue-700 text-center">
            {t("Chat communication in {{language}}", {
              language: currentLanguage.name,
            })}{" "}
            • {t("AI will understand and respond in this language")}
          </p>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex max-w-[80%] ${
                    message.sender === "user"
                      ? "flex-row-reverse"
                      : "flex-row"
                  } items-start space-x-2`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sender === "user"
                        ? "bg-slate-900 text-white ml-2"
                        : "bg-gray-200 text-gray-600 mr-2"
                    }`}
                  >
                    {message.sender === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.sender === "user"
                        ? "bg-slate-900 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p
                        className={`text-xs ${
                          message.sender === "user"
                            ? "text-slate-200"
                            : "text-gray-500"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                      {message.language && (
                        <span
                          className={`text-xs ml-2 px-1 py-0.5 rounded ${
                            message.sender === "user"
                              ? "bg-slate-800 text-slate-200"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {message.language.toUpperCase()}
                        </span>
                      )}
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
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("Type your message in {{language}}...", {
                language: currentLanguage.name,
              })}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {t("Press Enter to send • AI responds in {{language}}", {
              language: currentLanguage.name,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
