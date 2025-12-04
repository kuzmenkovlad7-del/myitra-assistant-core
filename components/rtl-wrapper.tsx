// @ts-nocheck
"use client"

import type React from "react"

import { useLanguage } from "@/lib/i18n/language-context"
import { useEffect, useState } from "react"

interface RTLWrapperProps {
  children: React.ReactNode
}

export function RTLWrapper({ children }: RTLWrapperProps) {
  const { currentLanguage } = useLanguage()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <div>{children}</div>
  }

  const isRTL = currentLanguage?.dir === "rtl"

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={isRTL ? "rtl" : "ltr"}>
      {children}
    </div>
  )
}

// Default export for compatibility
export default RTLWrapper
