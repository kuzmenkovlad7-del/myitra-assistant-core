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

  // State management
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Initialize with greeting in user's language
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetings: Record<string, string> = {
        en: "Hello! I'm your AI psychologist. How can I help you today?",
        ru: "Здравствуйте! Я ваш ИИ-психолог. Как я могу помочь вам сегодня?",
        uk: "Вітаю! Я ваш ШІ-психолог. Як я можу допомогти вам сьогодні?",
        es: "¡Hola! Soy tu psicólogo de IA. ¿Cómo puedo ayudarte hoy?",
        fr: "Bonjour! Je suis votre psychologue IA. Comment puis-je vous aider aujourd'hui?",
        de: "Hallo! Ich bin Ihr KI-Psychologe. Wie kann ich Ihnen heute helfen?",
        it: "Ciao! Sono il tuo psicologo AI. Come posso aiutarti oggi?",
        pt: "Olá! Sou seu psicólogo de IA. Como posso ajudá-lo hoje?",
        pl: "Cześć! Jestem twoim psychologiem AI. Jak mogę ci dzisiaj pomóc?",
        tr: "Merhaba! Ben sizin yapay zeka psikologunuzum. Bugün size nasıl yardımcı olabilirim?",
        ar: "مرحبا! أنا طبيبك النفسي بالذكاء الاصطناعي. كيف يمكنني مساعدتك اليوم؟",
        zh: "你好！我是你的AI心理学家���今天我能为你做些什么？",
        ja: "こんにちは！私はあなたのAI心理学者です。今日はどのようにお手伝いできますか？",
        ko: "안녕하세요! 저는 당신의 AI 심리학자입니다. 오늘 어떻게 도와드릴까요?",
        vi: "Xin chào! Tôi là nhà tâm lý học AI của bạn. Hôm nay tôi có thể giúp gì cho bạn?",
        he: "שלום! אני הפסיכולוג הבינה המלאכותית שלך. איך אני יכול לעזור לך היום?",
        el: "Γεια σας! Είμαι ο ψυχολόγος τεχνητής νοημοσύνης σας. Πώς μπορώ να σας βοηθήσω σήμερα;",
        sv: "Hej! Jag är din AI-psykolog. Hur kan jag hjälpa dig idag?",
        da: "Hej! Jeg er din AI-psykolog. Hvordan kan jeg hjælpe dig i dag?",
        et: "Tere! Olen teie tehisintellekti psühholoog. Kuidas saan teid täna aidata?",
        lv: "Sveiki! Es esmu jūsu mākslīgā intelekta psihologs. Kā es varu jums šodien palīdzēt?",
        lt: "Sveiki! Aš esu jūsų dirbtinio intelekto psichologas. Kaip galiu jums šiandien padėti?",
        ro: "Salut! Sunt psihologul tău AI. Cum te pot ajuta astăzi?",
        az: "Salam! Mən sizin süni intellekt psixoloqunuzam. Bu gün sizə necə kömək edə bilərəm?",
        kk: "Сәлеметсіз бе! Мен сіздің жасанды интеллект психологыңызбын. Бүгін сізге қалай көмектесе аламын?",
        ky: "Саламатсызбы! Мен сиздин жасалма акыл психологуңузмун. Бүгүн сизге кантип жардам бере алам?",
        tg: "Салом! Ман равоншиноси зеҳни сунъии шумо ҳастам. Имрӯз чӣ тавр ба шумо кӯмак карда метавонам?",
        uz: "Salom! Men sizning sun'iy intellekt psixologingizman. Bugun sizga qanday yordam bera olaman?",
      }

      const greeting = greetings[currentLanguage.code] || greetings.en

      const initialMessage: Message = {
        id: "initial",
        content: greeting,
        sender: "ai",
        timestamp: new Date(),
        language: currentLanguage.code,
      }

      setMessages([initialMessage])
    }
  }, [isOpen, messages.length, currentLanguage.code])

  // Process message with n8n webhook in user's language
  const processMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      setIsLoading(true)
      setIsTyping(true)

      try {
        console.log(`📤 Sending chat message in ${currentLanguage.name}: "${message}"`)

        // Use AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        // Include the current user language in the request
        const params = new URLSearchParams({
          text: message,
          language: currentLanguage.code, // Send user's selected language
          user: user?.email || "guest@example.com",
        })

        const webhookResponse = await fetch(
          `https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        )

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          throw new Error(`Webhook error: ${webhookResponse.status}`)
        }

        // Process the response
        let responseData
        const contentType = webhookResponse.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          responseData = await webhookResponse.json()
        } else {
          const textResponse = await webhookResponse.text()
          try {
            responseData = JSON.parse(textResponse)
          } catch (e) {
            responseData = { response: textResponse }
          }
        }

        console.log(`📥 Chat response in ${currentLanguage.name}:`, responseData)

        // Extract the response text
        let aiResponseText = ""

        if (typeof responseData === "string") {
          aiResponseText = responseData
        } else if (responseData && typeof responseData === "object") {
          if (Array.isArray(responseData) && responseData.length > 0) {
            const firstItem = responseData[0]
            aiResponseText =
              firstItem.output || firstItem.response || firstItem.text || firstItem.message || JSON.stringify(firstItem)
          } else {
            aiResponseText =
              responseData.response ||
              responseData.text ||
              responseData.message ||
              responseData.output ||
              responseData.content ||
              responseData.result ||
              JSON.stringify(responseData)
          }
        }

        // Clean up the response
        const cleanedResponse = aiResponseText
          .replace(/^\s*[{[]|\s*[}\]]$/g, "")
          .replace(/"output":|"response":|"text":|"message":/g, "")
          .replace(/["{}[\],]/g, "")
          .replace(/\s+/g, " ")
          .trim()

        if (!cleanedResponse) {
          throw new Error("Empty response received")
        }

        // Add AI response message
        const aiMessage: Message = {
          id: Date.now().toString() + "-ai",
          content: cleanedResponse,
          sender: "ai",
          timestamp: new Date(),
          language: currentLanguage.code,
        }

        setMessages((prev) => [...prev, aiMessage])
      } catch (error: any) {
        console.error("Error processing chat message:", error)

        let errorMessage = ""
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
          language: currentLanguage.code,
        }

        setMessages((prev) => [...prev, errorAiMessage])

        if (onError) {
          onError(error)
        }
      } finally {
        setIsLoading(false)
        setIsTyping(false)
      }
    },
    [currentLanguage.code, currentLanguage.name, user?.email, t, onError],
  )

  // Handle form submission
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

      setMessages((prev) => [...prev, userMessage])
      const messageToProcess = inputValue.trim()
      setInputValue("")

      await processMessage(messageToProcess)
    },
    [inputValue, isLoading, currentLanguage.code, processMessage],
  )

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as any)
      }
    },
    [handleSubmit],
  )

  // Format timestamp
  const formatTime = useCallback(
    (date: Date) => {
      return date.toLocaleTimeString(currentLanguage.code, {
        hour: "2-digit",
        minute: "2-digit",
      })
    },
    [currentLanguage.code],
  )

  if (!isOpen) return null

  // Get user email or translated guest label based on language
  const guestLabels: Record<string, string> = {
    en: "Guest (not signed in)",
    ru: "Гость (без входа)",
    uk: "Гість (без входу)",
  }
  const userEmail = user?.email || guestLabels[currentLanguage.code] || guestLabels.en

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        {/* Chat header */}
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">{t("AI Psychologist Chat")}</h3>
            <div className="text-xs text-lavender-200">
              {t("User")}: {userEmail}
            </div>
            <div className="text-xs text-lavender-200 mt-1 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-primary-700">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Language indicator */}
        <div className="px-4 py-2 bg-blue-50 border-b">
          <p className="text-sm text-blue-700 text-center">
            {t("Chat communication in {{language}}", { language: currentLanguage.name })} •{" "}
            {t("AI will understand and respond in this language")}
          </p>
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[80%] ${
                    message.sender === "user" ? "flex-row-reverse" : "flex-row"
                  } items-start space-x-2`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sender === "user" ? "bg-primary-600 text-white ml-2" : "bg-gray-200 text-gray-600 mr-2"
                    }`}
                  >
                    {message.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Message bubble */}
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
                      {message.language && (
                        <span
                          className={`text-xs ml-2 px-1 py-0.5 rounded ${
                            message.sender === "user" ? "bg-primary-700 text-primary-200" : "bg-gray-200 text-gray-600"
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

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center mr-2">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t bg-gray-50">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("Type your message in {{language}}...", { language: currentLanguage.name })}
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
            {t("Press Enter to send • AI responds in {{language}}", { language: currentLanguage.name })}
          </p>
        </div>
      </div>
    </div>
  )
}
