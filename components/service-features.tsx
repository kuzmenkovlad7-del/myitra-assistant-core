"use client"

import type React from "react"

import { Clock, CreditCard, UserCircle, Globe, BarChart, Shield } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

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
const AnimatedFeatureContainer = styled.div`
  .feature-card {
    transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
    
    &:hover {
      animation: ${cardRiseKeyframes} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      
      .feature-icon-container {
        animation: ${glowKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }
      
      .feature-icon {
        animation: ${iconPulseKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }
      
      .feature-title {
        color: var(--color-primary-700);
        transition: color 0.3s ease;
      }
      
      .feature-description {
        color: var(--color-primary-900);
        transition: color 0.3s ease;
      }
    }
  }
`

export default function ServiceFeatures() {
  const { t } = useLanguage()

  const features = [
    {
      icon: <Clock className="h-6 w-6 feature-icon" />,
      title: t("First 5 Minutes Free"),
      description: t("Try our service with no commitment. First 5 minutes of any session are completely free."),
    },
    {
      icon: <CreditCard className="h-6 w-6 feature-icon" />,
      title: t("Pay As You Go"),
      description: t("Only pay for the time you need. No subscriptions or hidden fees."),
    },
    {
      icon: <UserCircle className="h-6 w-6 feature-icon" />,
      title: t("Personalized Experience"),
      description: t("Our AI remembers your past sessions to provide better support over time."),
    },
    {
      icon: <Globe className="h-6 w-6 feature-icon" />,
      title: t("Multilingual Support"),
      description: t("Automatic language detection and support across all communication channels."),
    },
    {
      icon: <BarChart className="h-6 w-6 feature-icon" />,
      title: t("Emotion Recognition"),
      description: t("Advanced analysis of text and facial expressions to better understand your needs."),
    },
    {
      icon: <Shield className="h-6 w-6 feature-icon" />,
      title: t("Private & Secure"),
      description: t("Your data and conversations are protected with enterprise-grade security."),
    },
  ]

  return (
    <AnimatedFeatureContainer>
      <section
        className="py-12 sm:py-16 px-4 md:px-6 lg:px-8 bg-waves"
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
          <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-8 rounded-2xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4 text-primary-900">
              {t("Key Features")}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 text-center mb-8 sm:mb-12 max-w-3xl mx-auto px-4">
              {t(
                "Our AI-powered psychological support service combines cutting-edge technology with professional care principles.",
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm feature-card touch-manipulation">
                  <div className="h-12 w-12 rounded-full bg-lavender-100 flex items-center justify-center mb-4 text-primary-700 feature-icon-container">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2 feature-title">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 feature-description leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AnimatedFeatureContainer>
  )
}
