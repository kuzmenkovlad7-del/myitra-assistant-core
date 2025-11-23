"use client"

import { useState } from "react"
import { Check, ChevronDown, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/lib/i18n/language-context"
import { languages } from "@/lib/i18n/languages"
import { cn } from "@/lib/utils"

export function LanguageSelector() {
  const { currentLanguage, changeLanguage, t, isLoading } = useLanguage()
  const [open, setOpen] = useState(false)
  const [isChanging, setIsChanging] = useState(false)

  const handleLanguageChange = async (code: string) => {
    if (isChanging || currentLanguage.code === code) return

    try {
      setIsChanging(true)
      setOpen(false)
      await changeLanguage(code)
      // лёгкая задержка, чтобы не мигал поповер при смене языка
      await new Promise((resolve) => setTimeout(resolve, 120))
    } catch (error) {
      console.error("Error in language change:", error)
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={t("Select Language")}
          disabled={isChanging || isLoading}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-transparent px-3",
            "text-sm text-slate-600 hover:text-slate-900",
            "hover:bg-slate-100/70 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-900",
            "focus-visible:ring-2 focus-visible:ring-brand-indigo/40 focus-visible:ring-offset-0"
          )}
        >
          <Globe className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="hidden max-w-[6rem] truncate sm:inline">
            {currentLanguage.label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[220px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
      >
        <div className="flex flex-col gap-0.5">
          {languages.map((language) => {
            const isActive = currentLanguage.code === language.code

            return (
              <button
                key={language.code}
                type="button"
                onClick={() => handleLanguageChange(language.code)}
                disabled={isChanging || isActive}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  "disabled:cursor-not-allowed",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <span className="text-base">{language.flag}</span>
                <span className="flex-1 truncate">{language.label}</span>
                <span className="text-xs text-slate-400">({language.code})</span>
                {isActive && <Check className="h-4 w-4 text-brand-violet" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
