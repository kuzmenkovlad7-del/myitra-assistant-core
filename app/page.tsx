"use client"

import { PhoneCall, MessageSquare, Video } from "lucide-react"
import ServiceFeatures from "@/components/service-features"
import { HomeHero } from "@/components/home-hero"
import ContactSection from "@/components/contact-section"
import { ContactMethodCard } from "@/components/contact-method-card"
import { useLanguage } from "@/lib/i18n/language-context"
import { useState } from "react"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"

export default function Home() {
  const { t } = useLanguage()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  return (
    <div>
      <HomeHero />

      {/* Contact Methods Section */}
      <section id="assistant" className="py-16 px-4 md:px-6 lg:px-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
            Как вы хотите связаться с нами?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
