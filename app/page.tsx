"use client"

import { PhoneCall, MessageSquare, Video } from "lucide-react"
import { useState } from "react"

import ServiceFeatures from "@/components/service-features"
import { HomeHero } from "@/components/home-hero"
import ContactSection from "@/components/contact-section"
import { ContactMethodCard } from "@/components/contact-method-card"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"

export default function Home() {
  const { t } = useLanguage()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  return (
    <div className="bg-white">
      <HomeHero />

      {/* Contact Methods Section */}
      <section
        id="assistant"
        className="relative z-10 -mt-10 bg-gradient-to-b from-transparent via-slate-50 to-white px-4 pb-16 pt-14 md:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)] md:p-10">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Как вы хотите связаться с нами?
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ContactMethodCard
              icon={MessageSquare}
              title="Чат с ИИ-психологом"
              description="Текстовая поддержка в любой момент, когда нужно выговориться."
              buttonText="Начать чат"
              onClick={() => setIsChatOpen(true)}
            />

            <ContactMethodCard
              icon={PhoneCall}
              title="Позвонить ИИ-психологу"
              description="Голосовой формат для более живой поддержки."
              buttonText="Начать голосовой звонок"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  !window.SpeechRecognition &&
                  // @ts-expect-error webkitSpeechRecognition есть не во всех браузерах
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
              }}
            />

            <ContactMethodCard
              icon={Video}
              title="Видеозвонок с ИИ"
              description="Сессия с 3D-персонажем лицом к лицу."
              buttonText="Начать видеозвонок"
              onClick={() => {
                if (typeof window !== "undefined" && !navigator.mediaDevices) {
                  alert(
                    t(
                      "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.",
                    ),
                  )
                }
                setIsVideoCallOpen(true)
              }}
            />
          </div>
        </div>
      </section>

      <ServiceFeatures />

      <section id="contacts">
        <ContactSection />
      </section>

      <AIChatDialog
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        webhookUrl="https://nzzsd.app.n8n.cloud/webhook/coachai"
      />

      <VoiceCallDialog
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        webhookUrl="https://nzzsd.app.n8n.cloud/webhook/02949f8d-c062-463b-a664-7dc7a78f5472"
        openAiApiKey=""
        onError={(error) => {
          console.error("Voice call error:", error)
          alert(t("There was an issue with the voice call. Please try again."))
          setIsVoiceCallOpen(false)
        }}
      />

      <VideoCallDialog
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        webhookUrl="https://nzzsd.app.n8n.cloud/webhook/43103f8d-d98d-418d-8351-9a05241a3f4d"
        openAiApiKey=""
        onError={(error) => {
          console.error("Video call error:", error)
          alert(t("There was an issue with the video call. Please try again."))
          setIsVideoCallOpen(false)
        }}
      />
    </div>
  )
}
