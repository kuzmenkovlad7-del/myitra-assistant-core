"use client"

import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"

interface ContactMethodCardProps {
  icon: LucideIcon
  title: string
  description: string
  buttonText: string
  onClick: () => void
}

export function ContactMethodCard({
  icon: Icon,
  title,
  description,
  buttonText,
  onClick,
}: ContactMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-full text-left"
    >
      {/* градиентный бордер как у 21st.dev */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/0 via-indigo-500/20 to-sky-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex h-full flex-col rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-sm backdrop-blur transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899] text-white shadow-md shadow-indigo-500/30">
            <Icon className="h-7 w-7" />
          </div>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mb-6 flex-1 text-sm text-slate-600">{description}</p>

        <Button
          className="w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {buttonText}
        </Button>
      </div>
    </button>
  )
}
