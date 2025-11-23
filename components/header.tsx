"use client"

import { useState, useEffect, MouseEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { LanguageSelector } from "./language-selector"
import MobileNav from "./mobile-nav"
import Logo from "./logo"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

export default function Header() {
  const { t } = useLanguage()
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const isActive = (path: string) => pathname === path

  const navItems = [
    { href: "/", label: t("Home") },
    { href: "/programs", label: t("Programs") },
    { href: "/client-stories", label: t("Client Stories") },
    { href: "/contacts", label: t("Contacts") },
  ]

  const handleTalkNowClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (typeof window === "undefined") return

    // Если уже на главной — скроллим к секции ассистента
    if (pathname === "/") {
      const target =
        document.getElementById("assistant") ||
        document.getElementById("talk-now")
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
    }

    // Иначе — переходим на главную с якорем
    window.location.href = "/#assistant"
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/90 backdrop-blur border-b border-slate-200 py-2"
          : "bg-white/80 backdrop-blur border-b border-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors no-underline hover:no-underline ${
                isActive(item.href)
                  ? "text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Правый блок: язык + логин + CTA */}
        <div className="hidden md:flex items-center space-x-4">
          <LanguageSelector />

          {!isLoading && (
            <>
              {user ? (
                <Link href="/profile">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 rounded-full border-slate-300 text-slate-800 hover:bg-slate-900 hover:text-white"
                  >
                    <User size={16} />
                    <span>{t("Profile")}</span>
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      className="text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-full px-4"
                    >
                      {t("Sign In")}
                    </Button>
                  </Link>

                  <Link href="/#assistant" scroll={false}>
                    <Button
                      variant="outline"
                      onClick={handleTalkNowClick}
                      className="
                        relative rounded-full border border-slate-900
                        bg-white text-slate-900 text-sm font-semibold
                        px-6 py-2
                        shadow-[0_0_0_1px_rgba(15,23,42,0.04)]
                        hover:bg-slate-900 hover:text-white
                        transition-colors
                      "
                    >
                      {t("Talk now")}
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        <MobileNav />
      </div>
    </header>
  )
}
