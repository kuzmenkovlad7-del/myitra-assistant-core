"use client"

import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"
import { GlareCard } from "@/components/ui/glare-card"

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
    <GlareCard className="flex h-full flex-col justify-between p-6">
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="mb-6 flex-1 text-sm text-slate-200/85">{description}</p>
        <Button
          onClick={onClick}
          className="mt-auto w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
        >
          {buttonText}
        </Button>
      </div>
    </GlareCard>
  )
}
