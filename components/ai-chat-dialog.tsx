// components/ai-chat-dialog.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

type Props = {
  isOpen: boolean
  onClose: () => void
  webhookUrl?: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

export default function AIChatDialog({ isOpen, onClose, webhookUrl }: Props) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Сбрасываем состояние при закрытии
  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setInput("")
      setError(null)
      setIsSending(false)
    }
  }, [isOpen])

  // Автоскролл вниз
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isSending) return

    const url = (webhookUrl && webhookUrl.trim()) || "/api/chat"

    setError(null)
    setIsSending(true)
    setInput("")

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: currentLanguage || "uk",
          email: user?.email ?? null,
          mode: "chat",
        }),
      })

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }

      const data = (await res.json()) as { text?: string }
      const answer =
        data?.text ||
        t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error("Chat error:", err)
      setError(
        t(
          "AI assistant is temporarily unavailable. Please try again a bit later.",
        ),
      )
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-lg font-semibold">
            {t("Chat with AI-psychologist")}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {t(
              "Describe what is happening in your own words. The assistant will answer in a few short, structured messages.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-[420px]">
          {/* Сообщения */}
          <ScrollArea className="flex-1 px-5 pt-4 pb-2">
            <div ref={scrollRef} className="space-y-3 pr-1 max-h-full">
              {messages.length === 0 && (
                <p className="text-xs text-slate-500">
                  {t(
                    "You can start with one sentence: for example, 'I feel anxious and can't sleep', 'I can't concentrate', or 'I don't know what to do in a relationship'.",
                  )}
                </p>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs md:text-sm ${
                      msg.role === "user"
                        ? "bg-primary-600 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-900 rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Ошибка */}
          {error && (
            <div className="px-5 pb-1 text-xs text-red-600">{error}</div>
          )}

          {/* Форма ввода */}
          <form onSubmit={handleSubmit} className="border-t border-slate-100">
            <div className="px-5 py-3 space-y-2">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("Write here what is happening to you...")}
                className="resize-none text-sm"
              />

              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-slate-400">
                  {t(
                    "In crisis situations, please contact local emergency services immediately.",
                  )}
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSending || !input.trim()}
                  className="h-8 px-3 text-xs"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {t("Sending")}
                    </>
                  ) : (
                    <>
                      {t("Send")}
                      <Send className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
