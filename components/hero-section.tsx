"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

export default function HeroSection() {
  const { t } = useLanguage()

  return (
    <section className="relative py-12 sm:py-16 md:py-20 px-4 md:px-6 lg:px-8 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              {t("AI-Powered Psychological Support")}
            </h1>
            <p className="text-lg sm:text-xl mb-6 sm:mb-8 text-lavender-100 leading-relaxed">
              {t(
                "Professional, personalized psychological care through advanced AI technology. Connect through voice, chat, or video calls with our AI psychologist.",
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button className="bg-white text-primary-900 hover:bg-lavender-100 px-6 py-6 text-base sm:text-lg touch-manipulation w-full sm:w-auto">
                {t("Get Started")}
              </Button>
              <Link href="/about" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="border-white text-white bg-transparent hover:bg-white/20 px-6 py-6 text-base sm:text-lg touch-manipulation w-full"
                >
                  {t("About")}
                </Button>
              </Link>
            </div>
            <p className="mt-4 sm:mt-6 text-sm text-lavender-200">
              {t("First 5 minutes free, then pay-as-you-go for continued support.")}
            </p>
          </div>
          <div className="relative mt-6 lg:mt-0">
            <div className="aspect-video rounded-xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm p-2 sm:p-4">
              <video
                className="w-full h-full object-cover rounded-lg"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={t("AI psychology visualization")}
              >
                <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/vidos-CoL5xAYKpoWhTtG7SJY2HqgP4QYKj3.mp4" type="video/mp4" />
                {t("Your browser does not support the video tag.")}
              </video>
            </div>
            <div className="absolute -bottom-3 -right-2 sm:-bottom-6 sm:-right-6 bg-white text-primary-900 rounded-lg p-3 sm:p-4 shadow-lg text-xs sm:text-base max-w-[200px] sm:max-w-none">
              <p className="font-semibold text-sm sm:text-base">{t("Multilingual Support")}</p>
              <p className="text-xs sm:text-sm">{t("Automatic language detection")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
