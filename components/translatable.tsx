// @ts-nocheck
"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { useEffect, useRef, type ReactNode, type JSX } from "react"

interface TranslatableProps {
  id: string
  children: ReactNode
  params?: Record<string, string>
  fallback?: string
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export function Translatable({
  id,
  children,
  params,
  fallback,
  className = "",
  as: Component = "span",
}: TranslatableProps) {
  const { t, currentLanguage } = useLanguage()
  const elementRef = useRef<HTMLElement>(null)

  // Get translation with parameters
  const translation = t(id, params) || fallback || children

  // Update the element's data-i18n attribute for consistency
  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.setAttribute("data-i18n", id)
      if (params) {
        elementRef.current.setAttribute("data-i18n-params", JSON.stringify(params))
      }
    }
  }, [id, params])

  return (
    <Component
      ref={elementRef}
      className={className}
      data-i18n={id}
      data-i18n-params={params ? JSON.stringify(params) : undefined}
    >
      {translation}
    </Component>
  )
}
