"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Loader2, Sparkles } from "lucide-react"

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
import { APP_NAME } from "@/lib/app-config"

type Props = {
  isOpen: boolean
  onClose: () => void
  /** URL вебхука Workflow-агента; если не передан – используем /api/chat как резерв */
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

  // Сброс при закрытии
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

  const extractAnswerText = (raw: any): string => {
    if (!raw) return ""

    // 1) Строка напрямую
    if (typeof raw === "string") return raw

    // 2) Массив (часто так возвращает n8n)
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0]
      if (typeof first === "string") return first

      if (first && typeof first === "object") {
        return (
          first.text ||
          first.response ||
          first.message ||
          first.output ||
          first.content ||
          first.result ||
          JSON.stringify(first)
        )
      }
    }

    // 3) Объект
    if (raw && typeof raw === "object") {
      return (
        raw.text ||
        raw.response ||
        raw.message ||
        raw.output ||
        raw.content ||
        raw.result ||
        JSON.stringify(raw)
      )
    }

    return ""
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isSending) return

    // основной источник – вебхук агента, запасной – /api/chat
    const url = (webhookUrl && webhookUrl.trim()) || "/api/chat"

    setError(null)
    setIsSending(true)
    setInput("")

    const langCode =
      typeof (currentLanguage as any) === "string"
        ? (currentLanguage as any as string)
        : (currentLanguage as any)?.code || "uk"

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const payload = {
        query: text,
        language: langCode,
        email: user?.email ?? null,
        mode: "chat", // просто метка, backend может игнорировать
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }

      const contentType = res.headers.get("content-type") || ""
      let rawData: any

      if (contentType.includes("application/json")) {
        rawData = await res.json()
      } else {
        const rawText = await res.text()
        try {
          rawData = JSON.parse(rawText)
        } catch {
          rawData = { response: rawText }
        }
      }

      let answer = extractAnswerText(rawData)

      if (!answer || !answer.trim()) {
        answer = t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )
      }

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
      <DialogContent className="max-w-xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {t("Chat with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "Describe what is happening in your own words. The assistant will answer in a few short, structured messages.",
                  )}
                </DialogDescription>
              </div>

              <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                {APP_NAME} · {t("Assistant online")}
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1">
                {messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                    <p className="font-medium text-slate-900">
                      {t("How to start")}
                    </p>
                    <p className="mt-1">
                      {t(
                        "You can start with one sentence: for example, 'I feel anxious and can't sleep', 'I can't concentrate', or 'I don't know what to do in a relationship'.",
                      )}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs md:text-sm ${
                        msg.role === "user"
                          ? "rounded-br-sm bg-slate-900 text-white shadow-sm"
                          : "rounded-bl-sm bg-slate-50 text-slate-900 shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {error && (
              <div className="px-5 pb-1 text-xs text-red-600">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="border-t border-slate-100">
              <div className="space-y-2 px-5 py-3">
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
                    className="h-8 rounded-full bg-indigo-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t("Sending")}
                      </>
                    ) : (
                      <>
                        {t("Send")}
                        <Send className="ml-1 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
