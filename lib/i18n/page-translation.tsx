"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useLanguage } from "./language-context"

export function PageTranslation() {
  const pathname = usePathname()
  const { currentLanguage, translations } = useLanguage()

  // Re-translate the page whenever the path changes or language changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      // Small delay to ensure the DOM is fully loaded
      setTimeout(() => {
        // Find all elements with data-i18n attributes
        const elements = document.querySelectorAll("[data-i18n]")
        elements.forEach((element) => {
          const key = element.getAttribute("data-i18n")
          if (key && translations[key]) {
            element.textContent = translations[key]
          }
        })

        // Find all elements with placeholder attributes
        document.querySelectorAll("[placeholder]").forEach((element) => {
          const placeholder = element.getAttribute("placeholder")
          if (placeholder && translations[placeholder]) {
            element.setAttribute("placeholder", translations[placeholder])
          }
        })

        // Find all elements with title attributes
        document.querySelectorAll("[title]").forEach((element) => {
          const title = element.getAttribute("title")
          if (title && translations[title]) {
            element.setAttribute("title", translations[title])
          }
        })

        // Find all elements with aria-label attributes
        document.querySelectorAll("[aria-label]").forEach((element) => {
          const ariaLabel = element.getAttribute("aria-label")
          if (ariaLabel && translations[ariaLabel]) {
            element.setAttribute("aria-label", translations[ariaLabel])
          }
        })
      }, 100)
    }
  }, [pathname, currentLanguage, translations])

  return null
}
