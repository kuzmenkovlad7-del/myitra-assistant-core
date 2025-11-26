// app/page.tsx
"use client"

import { useState } from "react"
import { PhoneCall, MessageSquare, Video, ArrowRight } from "lucide-react"

import { HomeHero } from "@/components/home-hero"
import ServiceFeatures from "@/components/service-features"
import ContactSection from "@/components/contact-section"
import { ContactMethodCard } from "@/components/contact-method-card"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"
import { ShineBorder } from "@/components/ui/shine-border"
import { RainbowButton } from "@/components/ui/rainbow-button"

// webhooks ассистентов берём из .env
const CHAT_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_CHAT_WEBHOOK_URL || "/api/chat"
const VOICE_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_VOICE_WEBHOOK_URL || ""
const VIDEO_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_VIDEO_WEBHOOK_URL || ""

export default function Home() {
  const { t } = useLanguage()

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  const openChat = () => {
    setIsChatOpen(true)
  }

  const openVoice = () => {
    if (!VOICE_WEBHOOK) {
      alert(
        t(
          "Voice assistant is temporarily unavailable. Webhook is not configured yet.",
        ),
      )
      return
    }

    if (
      typeof window !== "undefined" &&
      // @ts-ignore
      !window.SpeechRecognition &&
      // @ts-ignore
      !window.webkitSpeechRecognition &&
      !navigator.mediaDevices
    ) {
      alert(
        t(
          "Your browser may not fully support voice features. For the best experience, please use Chrome, Edge, or Safari.",
        ),
      )
    }

    setIsVoiceCallOpen(true)
  }

  const openVideo = () => {
    if (!VIDEO_WEBHOOK) {
      alert(
        t(
          "Video assistant is temporarily unavailable. Webhook is not configured yet.",
        ),
      )
      return
    }

    if (typeof window !== "undefined" && !navigator.mediaDevices) {
      alert(
        t(
          "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.",
        ),
      )
    }

    setIsVideoCallOpen(true)
  }

  // ... остальной JSX можешь оставить как у тебя сейчас
}
