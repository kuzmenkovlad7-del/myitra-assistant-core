"use client"

import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

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
    <div className="flex flex-col bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow p-6">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899] mb-4">
        <Icon className="h-7 w-7 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 flex-1">{description}</p>
      <Button
        onClick={onClick}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {buttonText}
      </Button>
    </div>
  )
}
