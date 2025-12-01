// components/home-hero.tsx
"use client"

import type React from "react"
import Image from "next/image"
import Link from "next/link"               // 👈 добавили
import { ArrowRight } from "lucide-react"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const chips = [
    t("When it feels bad right now"),
    t("Anxiety, stress & burnout"),
    t("7–21 day support programs"),
  ]

  return (
    <section
      className="
        relative overflow-hidden
        bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50/35
      "
    >
      {/* ...всё без изменений до блока с кнопками... */}

          {/* Кнопки */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <a href="#assistant">
              <RainbowButton className="h-12 rounded-full px-7 text-sm font-semibold text-white">
                <span>{t("Start for free")}</span>
                <ArrowRight className="h-4 w-4" />
              </RainbowButton>
            </a>

            <Link
              href="/about"                 // 👈 ведёт на страницу «Про нас»
              className="
                inline-flex h-12 items-center justify-center rounded-full
                border border-slate-200 bg-white px-6 text-sm font-semibold
                text-slate-900 shadow-sm
                transition-colors
                hover:bg-slate-100 hover:text-slate-900
              "
            >
              {t("How it works")}
            </Link>
          </div>

          {/* чипы под кнопками */}
          <div className="flex flex-wrap gap-3">
            {chips.map((chip) => (
              <span
                key={chip}
                className="
                  inline-flex items-center rounded-full
                  border border-slate-200 bg-white px-4 py-1
                  text-xs text-slate-600 shadow-sm
                "
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* Правая колонка: психолог + бейдж ассистентов */}
        <div className="relative mt-10 flex justify-center md:mt-0">
          {/* большая мягкая "аура" */}
          <div className="pointer-events-none absolute inset-0 translate-x-4 bg-[radial-gradient(circle_at_top,_rgba(165,180,252,0.75),transparent_65%)]" />

          {/* фотография психолога без рамки */}
          <div className="relative z-10 flex items-end">
            <Image
              src="/ai-psychology-hero.png"
              alt="TurbotaAI AI psychologist"
              width={520}
              height={720}
              priority
              className="h-auto w-full max-w-sm md:max-w-md object-contain drop-shadow-2xl"
            />
          </div>

          {/* карточка 3 assistant modes */}
          <div
            className="
              absolute bottom-6 right-2 z-20
              w-full max-w-xs
              rounded-3xl bg-white/95 px-5 py-3
              shadow-[0_18px_45px_rgba(15,23,42,0.25)]
              ring-1 ring-slate-200/70
              backdrop-blur-md
            "
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white shadow-lg">
                💬
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-900">
                  {t("3 assistant modes · chat · voice · video")}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t("Choose how it's more comfortable for you to talk.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeHero
