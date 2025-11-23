"use client"

// Import the necessary animation libraries at the top of the file
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import type React from "react"
import { Mail, Phone, MapPin } from "lucide-react"
import ContactForm from "./contact-form"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "./auto-translate"

// Update the keyframes definitions to be smoother
const iconPulseKeyframes = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`

const cardRiseKeyframes = keyframes`
  0% { transform: translateY(0); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  100% { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(2,90,160,0.12); }
`

const glowKeyframes = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(2,90,160,0); }
  50% { box-shadow: 0 0 8px 2px rgba(2,90,160,0.2); }
  100% { box-shadow: 0 0 0 0 rgba(2,90,160,0); }
`

// Update the styled component with smoother animations
const AnimatedContactContainer = styled.div`
  .contact-card {
    transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
    
    &:hover {
      animation: ${cardRiseKeyframes} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      
      .contact-icon-container {
        animation: ${glowKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }
      
      .contact-icon {
        animation: ${iconPulseKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }
      
      .contact-title {
        color: var(--color-primary-700);
        transition: color 0.3s ease;
      }
      
      .contact-details {
        color: var(--color-primary-900);
        transition: color 0.3s ease;
      }
    }
  }
`

export default function ContactSection() {
  const { t } = useLanguage()

  const contactInfo = [
    {
      icon: <Mail className="h-6 w-6 contact-icon" />,
      title: t("Email Us"),
      details: "support@aipsychologist.com",
      description: t("For general inquiries and support"),
    },
    {
      icon: <Phone className="h-6 w-6 contact-icon" />,
      title: t("Call Us"),
      details: "+7 (800) 123-4567",
      description: t("Monday to Friday, 9am to 5pm"),
    },
    {
      icon: <MapPin className="h-6 w-6 contact-icon" />,
      title: t("Visit Us"),
      details: t("123 AI Avenue, Tech City"),
      description: t("By appointment only"),
    },
  ]

  return (
    <AnimatedContactContainer>
      <AutoTranslate>
        <section
          id="contact"
          className="py-16 px-4 md:px-6 lg:px-8 bg-waves"
          style={
            {
              backgroundImage: "url('/blue-waves-bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
              "--color-primary-700": "#025aa0",
              "--color-primary-900": "#0a416f",
            } as React.CSSProperties
          }
        >
          <div className="max-w-6xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-primary-900 mb-4">{t("Contact Us")}</h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  {t(
                    "Have questions or need assistance? Reach out to our support team and we'll get back to you as soon as possible.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
                {contactInfo.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white p-6 rounded-xl shadow-sm flex flex-col items-center text-center contact-card"
                  >
                    <div className="h-12 w-12 rounded-full bg-lavender-100 flex items-center justify-center mb-4 text-primary-700 contact-icon-container">
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2 contact-title">{item.title}</h3>
                    <p className="text-primary-700 font-medium mb-2 contact-details">{item.details}</p>
                    <p className="text-gray-500">{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
                <h3 className="text-2xl font-bold text-primary-900 mb-6 text-center">{t("Send Us a Message")}</h3>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </AutoTranslate>
    </AnimatedContactContainer>
  )
}
