"use client"

import type React from "react"
import Image from "next/image"
import { MessageCircle, ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { Button } from "@/components/ui/button"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToAssistant = () => {
    if (typeof document === "undefined") return
    const el = document.getElementById("assistant")
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100"
    >
      {/* мягкий фон от фото */}
      <div className="pointer-events-none absolute inset-y-0 right-[-10%] w-[60%] bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.35),transparent_60%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] max-w-6xl items-center px-4 pb-24 pt-20 md:px-6 md:pt-24 lg:px-8 lg:pb-32">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* Левая часть */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("AI-psychologist nearby 24/7")}
            </div>

            <div>
              <h1 className="text-3xl leading-tight text-slate-900 sm:text-4xl md:text-5xl md:leading-tight">
                {t("Live psychological support, powered by AI")}
              </h1>
              <p className="mt-4 max-w-xl text-sm text-slate-600 sm:text-base">
                {t(
                  "Talk to an AI-powered psychologist when you feel exhausted, anxious or alone. They listen, ask clarifying questions and gently guide you with exercises — in chat, voice or video.",
                )}
              </p>
            </div>

            {/* CTA-кнопки */}
            <div className="flex flex-wrap items-center gap-4">
              <RainbowButton
                type="button"
                onClick={scrollToAssistant}
                className="shadow-xl shadow-indigo-500/30"
              >
                {t("Talk now")}
                <ArrowRight className="h-4 w-4" />
              </RainbowButton>

              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100 hover:text-slate-900"
              >
                {t("Programs")}
              </Button>
            </div>

            {/* Теги-сценарии */}
            <div className="flex flex-wrap gap-3">
              {[
                t("When it feels bad right now"),
                t("Anxiety & stress programs"),
                t("Gentle long-term support"),
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-indigo-300 hover:text-slate-800"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Правая часть: психолог + плашка ассистентов */}
          <div className="relative mt-6 flex items-center justify-center lg:mt-0 lg:justify-end">
            {/* радиальный градиент под фото */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_rgba(15,23,42,0.25),transparent_65%)]" />

            <div className="relative flex flex-col items-center">
              <Image
                src="/ai-psychology-hero.png"
                alt="MyITRA AI psychologist"
                width={420}
                height={520}
                priority
                className="h-auto w-[260px] sm:w-[320px] md:w-[360px] lg:w-[400px] object-contain drop-shadow-[0_30px_90px_rgba(15,23,42,0.45)]"
              />

              {/* Плашка про 3 режима ассистента */}
              <div className="mt-5 w-full max-w-[360px] rounded-full border border-slate-200 bg-white/95 px-5 py-3 shadow-lg shadow-indigo-500/15 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-fuchsia-500 to-indigo-500 text-white shadow-md">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-xs leading-snug text-slate-700">
                    <div className="font-semibold">
                      {t("3 assistant modes · chat · voice · video")}
                    </div>
                    <div className="text-slate-500">
                      {t("Choose how it's more comfortable for you to talk.")}
                    </div>
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
