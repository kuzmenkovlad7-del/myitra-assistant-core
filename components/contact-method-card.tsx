"use client"

import type React from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContactMethodCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: string
  benefits?: string[]
  buttonText: string
  onClick?: () => void
}

export function ContactMethodCard({
  icon: Icon,
  title,
  description,
  benefits,
  buttonText,
  onClick,
}: ContactMethodCardProps) {
  const handleClick = () => {
    if (onClick) onClick()
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (onClick) onClick()
    }
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={cn(
        "group flex h-full flex-col justify-between rounded-3xl",
        "bg-slate-50/90 px-6 py-6 text-left shadow-sm ring-1 ring-slate-200",
        "transition hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/80",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50",
      )}
    >
      <div>
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>

        <h3 className="mb-2 text-base font-semibold text-slate-900">
          {title}
        </h3>

        <p className="text-sm text-slate-600">{description}</p>

        {benefits && benefits.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs text-slate-500">
            {benefits.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition group-hover:bg-slate-900/90">
        {buttonText}
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </div>
    </div>
  )
}
