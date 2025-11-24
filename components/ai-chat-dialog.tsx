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

// 1) базовый URL вебхука: сначала берём проп, потом .env, потом дефолт
const DEFAULT_CHAT_WEBHOOK =
  "https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59"

const CHAT_WEBHOOK_URL =
  (typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_CHAT_WEBHOOK_URL
    : (process.env.NEXT_PUBLIC_CHAT_WEBHOOK_URL as string)) || DEFAULT_CHAT_WEBHOOK

export default function AIChatDialog({ isOpen, onClose, webhookUrl, onError }: AIChatDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const langCode = currentLanguage?.code || "en"
  const langName = currentLanguage?.name || "English"

  // State
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // 2) Приветствие только для uk/ru/en
  useEffect(() => {
    if (!isOpen) return
    if (messages.length > 0) return

    const greetings: Record<string, string> = {
      en: "Hello! I'm your AI psychologist. How can I help you today?",
      ru: "Здравствуйте! Я ваш ИИ-психолог. Как я могу помочь вам сегодня?",
      uk: "Вітаю! Я ваш ШІ-психолог. Як я можу допомогти вам сьогодні?",
    }

    const greeting = greetings[langCode] || greetings.en

    const initialMessage: Message = {
      id: "initial",
      content: greeting,
      sender: "ai",
      timestamp: new Date(),
      language: langCode,
    }

    setMessages([initialMessage])
  }, [isOpen, messages.length, langCode])

  // 3) отправка в n8n
  const processMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      const finalWebhook = webhookUrl || CHAT_WEBHOOK_URL

      // если урл пустой — не ломаем UI, а аккуратно говорим пользователю
      if (!finalWebhook) {
        const offlineMessage: Message = {
          id: Date.now().toString() + "-offline",
          content: t("Chat is temporarily unavailable. Please try again later."),
          sender: "ai",
          timestamp: new Date(),
          language: langCode,
        }
        setMessages((prev) => [...prev, offlineMessage])
        return
      }

      setIsLoading(true)
      setIsTyping(true)

      try {
        console.log(`📤 Sending chat message to n8n in ${langName}`, { langCode, message })

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const params = new URLSearchParams({
          text: message,
          language: langCode,
          user: user?.email || "guest@example.com",
          source: "chat",
        })

        const urlWithParams = `${finalWebhook}?${params.toString()}`

        const webhookResponse = await fetch(urlWithParams, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          const text = await webhookResponse.text().catch(() => "")
          console.warn("❗ n8n webhook error", webhookResponse.status, text)
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

        console.log("📥 n8n response:", responseData)

        // вытаскиваем текст
        let aiResponseText = ""

        if (typeof responseData === "string") {
          aiResponseText = responseData
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          const first = responseData[0]
          aiResponseText =
            first?.response || first?.text || first?.message || first?.output || JSON.stringify(first)
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
          .replace(/"output":|"response":|"text":|"message":|"content":/g, "")
          .replace(/["{}[\]]/g, "")
          .replace(/\s+/g, " ")
          .trim()

        if (!cleanedResponse) {
          throw new Error("Empty response")
        }

        const aiMessage: Message = {
          id: Date.now().toString() + "-ai",
          content: cleanedResponse,
          sender: "ai",
          timestamp: new Date(),
          language: langCode,
        }

        setMessages((prev) => [...prev, aiMessage])
      } catch (error: any) {
        console.error("Chat process error:", error)

        let errorMessage: string
        if (error.name === "AbortError") {
          errorMessage = t("Connection timeout. Please try again.")
        } else {
          errorMessage = t("I'm sorry, I couldn't process your message. Please try again.")
        }

        const errorAiMessage: Message = {
          id: Date.now().toString() + "-error",
          content: errorMessage,
          sender: "ai",
          timestamp: new Date(),
          language: langCode,
        }

        setMessages((prev) => [...prev, errorAiMessage])

        onError?.(error)
      } finally {
        setIsLoading(false)
        setIsTyping(false)
      }
    },
    [langCode, langName, user?.email, webhookUrl, t, onError],
  )

  // 4) submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isLoading) return

      const text = inputValue.trim()

      const userMessage: Message = {
        id: Date.now().toString() + "-user",
        content: text,
        sender: "user",
        timestamp: new Date(),
        language: langCode,
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue("")

      await processMessage(text)
    },
    [inputValue, isLoading, langCode, processMessage],
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
      date.toLocaleTimeString(langCode, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [langCode],
  )

  if (!isOpen) return null

  const guestLabels: Record<string, string> = {
    en: "Guest (not signed in)",
    ru: "Гость (без входа)",
    uk: "Гість (без входу)",
  }

  const userEmail = user?.email || guestLabels[langCode] || guestLabels.en

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col h-[80vh] max-h-[640px] overflow-hidden">
        {/* HEADER */}
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white">
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg">{t("AI Psychologist Chat")}</h3>
            <div className="text-xs text-primary-100">
              {t("User")}: {userEmail}
            </div>
            <div className="text-xs text-primary-100 mt-1 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              {t("Language")}: {langName} {currentLanguage?.flag}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-primary-700">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* INFO BAR */}
        <div className="px-4 py-2 bg-blue-50 border-b">
          <p className="text-sm text-blue-700 text-center">
            {t("Chat communication in {{language}}", { language: langName })} •{" "}
            {t("AI will understand and respond in this language")}
          </p>
        </div>

        {/* MESSAGES */}
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
                      message.sender === "user" ? "bg-primary-600 text-white ml-2" : "bg-slate-100 text-slate-600 mr-2"
                    }`}
                  >
                    {message.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      message.sender === "user" ? "bg-primary-600 text-white" : "bg-slate-50 text-slate-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span
                        className={`text-[11px] ${
                          message.sender === "user" ? "text-primary-100" : "text-slate-500"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </span>
                      <span
                        className={`text-[10px] ml-2 px-1.5 py-0.5 rounded ${
                          message.sender === "user"
                            ? "bg-primary-700 text-primary-100"
                            : "bg-slate-200 text-slate-700"
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mr-2">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-slate-50 rounded-2xl px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                      <div
                        className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <div
                        className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* INPUT */}
        <div className="p-4 border-t bg-slate-50">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("Type your message in {{language}}...", { language: langName })}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-primary-600 hover:bg-primary-700 rounded-xl"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="text-[11px] text-slate-500 mt-2 text-center">
            {t("Press Enter to send • AI responds in {{language}}", { language: langName })}
          </p>
        </div>
      </div>
    </div>
  )
}
