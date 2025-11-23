"use client"

import Image from "next/image"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToSection = (sectionId: string) => {
    const element = document.querySelector(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <section className="relative w-full overflow-hidden bg-background">
      <div className="container relative mx-auto px-4 py-12 md:py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight text-gray-900 md:text-5xl lg:text-6xl">
              Живая психологическая поддержка, усиленная ИИ
            </h1>

            <p className="text-lg text-muted-foreground md:text-xl">
              Лицензированные психологи с поддержкой ИИ-ассистентов. Помогаем снизить уровень стресса, разобраться в эмоциях и выстроить привычку заботы о себе.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row pt-2">
              <Button
                onClick={() => scrollToSection("#assistant")}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Поговорить сейчас
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-border"
                onClick={() => scrollToSection("#assistant")}
              >
                Посмотреть программы
              </Button>
            </div>
          </div>

          {/* Right Column - Character Card */}
          <div className="relative mt-8 lg:mt-0">
            <div className="relative aspect-[4/5] w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
              <Image
                src="/ai-psychology-hero.png"
                alt="AI Psychology Character"
                fill
                className="object-cover"
                priority
              />

              {/* Bottom Pill */}
              <div className="absolute bottom-4 left-4 right-4 rounded-full border border-border bg-white/95 backdrop-blur-sm shadow-md px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* Pulsating Circle Icon */}
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899]">
                    <Heart className="h-5 w-5 text-white z-10" />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899] animate-pulse-circle" />
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      3 режима ассистента · чат · голос · видео
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
