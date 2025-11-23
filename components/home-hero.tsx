"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HomeHero() {
  const handleScrollToAssistant = () => {
    if (typeof window === "undefined") return
    const element = document.querySelector("#assistant")
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-white via-slate-50 to-slate-50/70">
      <div className="container mx-auto grid max-w-6xl items-center gap-10 px-4 pt-16 pb-20 md:px-6 md:pt-20 md:pb-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 lg:pt-24 lg:pb-28">
        {/* Left column: text */}
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>AI-psychologist nearby 24/7</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Live psychological
              <br />
              support, powered by AI
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Talk to an AI-powered psychologist when you feel exhausted, anxious or alone. They listen, ask clarifying
              questions and gently guide you with exercises — in chat, voice or video.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button
              size="lg"
              className="w-full rounded-full bg-slate-900 px-8 text-base font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.38)] hover:bg-slate-800 hover:shadow-[0_18px_55px_rgba(15,23,42,0.5)] sm:w-auto"
              onClick={handleScrollToAssistant}
            >
              Поговорити зараз
            </Button>

            <Link href="/programs" className="sm:inline-flex w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full border-slate-300 bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-900 hover:text-white sm:w-auto"
              >
                Programs
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-500 sm:text-[13px]">
            <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm">
              When it feels bad right now
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm">
              Anxiety & stress programs
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm">
              Gentle long-term support
            </span>
          </div>
        </div>

        {/* Right column: psychologist image */}
        <div className="relative flex justify-center lg:justify-end">
          <div className="relative w-full max-w-md lg:max-w-lg">
            {/* Soft card behind the cut-out photo */}
            <div className="absolute inset-x-4 top-6 bottom-0 rounded-[32px] border border-slate-100 bg-white/90 shadow-[0_35px_90px_rgba(15,23,42,0.35)]" />

            {/* Photo itself – png with transparent background */}
            <div className="relative z-10 flex h-full items-end justify-center px-4 pb-10 pt-10">
              <Image
                src="/ai-psychology-hero.png"
                alt="Calm female psychologist ready to talk"
                width={640}
                height={800}
                priority
                className="h-auto w-full max-w-xs object-contain sm:max-w-sm"
              />
            </div>

            {/* Bottom pill with assistant modes */}
            <div className="absolute bottom-4 left-1/2 z-20 flex w-[82%] max-w-sm -translate-x-1/2 items-center gap-3 rounded-full border border-slate-100 bg-white/95 px-4 py-2.5 shadow-[0_16px_45px_rgba(15,23,42,0.33)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899]">
                <span className="h-2 w-2 rounded-full bg-white/90" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold text-slate-900">
                  3 assistant modes · чат · голос · відео
                </span>
                <span className="truncate text-[11px] text-slate-500">
                  Choose how it&apos;s more comfortable for you to talk.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
