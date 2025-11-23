"use client"

import { useEffect, useRef } from "react"
import { useLanguage } from "@/lib/i18n/language-context"

export function useAutoTranslate<T extends HTMLElement>() {
  const { translateElement } = useLanguage()
  const ref = useRef<T>(null)

  useEffect(() => {
    if (ref.current) {
      translateElement(ref.current)
    }
  }, [translateElement])

  return ref
}
