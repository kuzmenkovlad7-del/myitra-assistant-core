"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"
import { useLanguage } from "@/lib/i18n/language-context"
import Logo from "@/components/logo"

const mainLinks = [
  { href: "/", label: "nav.home" },
  { href: "/programs", label: "nav.programs" },
  { href: "/client-stories", label: "nav.clientStories" },
  { href: "/contacts", label: "nav.contacts" },
]

export default function Header() {
  const { t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (href.startsWith("#")) {
      e.preventDefault()
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
        setMobileMenuOpen(false)
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Logo />
          <span className="text-xl font-semibold text-slate-900">Myitra</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 lg:flex">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSelector />

          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-800 hover:bg-slate-100"
            >
              {t("Sign In")}
            </Button>
          </Link>

          <Button
            onClick={() => {
              const element = document.querySelector("#assistant")
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            }}
            size="sm"
            variant="outline"
            className="rounded-full border-slate-900 bg-white px-5 text-slate-900 hover:bg-slate-900 hover:text-white hover:shadow-md"
          >
            {t("Talk Now")}
          </Button>
        </div>

        {/* Mobile nav */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="text-slate-800">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-[300px] border-border bg-white">
            <div className="flex flex-col gap-6 pt-6">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="text-xl font-semibold text-slate-900">
                  Myitra
                </span>
              </div>

              <nav className="flex flex-col gap-4">
                {mainLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="text-base font-medium text-slate-800 transition-colors hover:text-slate-900"
                  >
                    {t(link.label)}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-slate-200 pt-6">
                <LanguageSelector />
              </div>

              <div className="flex flex-col gap-3">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full border-slate-300 text-slate-800 hover:bg-slate-100"
                  >
                    {t("Sign In")}
                  </Button>
                </Link>

                <Button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    const element = document.querySelector("#assistant")
                    if (element) {
                      element.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  }}
                  className="w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
                >
                  {t("Talk Now")}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
