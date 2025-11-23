"use client"

import { useState, useEffect } from "react"
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

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-white shadow-md py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-primary-600 ${
              isActive("/") ? "text-primary-600" : "text-gray-700"
            }`}
          >
            {t("Home")}
          </Link>
          <Link
            href="/about"
            className={`text-sm font-medium transition-colors hover:text-primary-600 ${
              isActive("/about") ? "text-primary-600" : "text-gray-700"
            }`}
          >
            {t("About")}
          </Link>
          <Link
            href="/services"
            className={`text-sm font-medium transition-colors hover:text-primary-600 ${
              isActive("/services") ? "text-primary-600" : "text-gray-700"
            }`}
          >
            {t("Services")}
          </Link>
          <Link
            href="/pricing"
            className={`text-sm font-medium transition-colors hover:text-primary-600 ${
              isActive("/pricing") ? "text-primary-600" : "text-gray-700"
            }`}
          >
            {t("Pricing")}
          </Link>
          <Link
            href="/#contact"
            className={`text-sm font-medium transition-colors hover:text-primary-600 ${
              isActive("/contact") ? "text-primary-600" : "text-gray-700"
            }`}
            onClick={(e) => {
              // If we're already on the home page, prevent default navigation
              // and scroll to the contact section smoothly
              if (pathname === "/") {
                e.preventDefault()
                document.getElementById("contact")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            }}
          >
            {t("Contact")}
          </Link>
        </nav>

        <div className="hidden md:flex items-center space-x-4">
          <LanguageSelector />

          {!isLoading && (
            <>
              {user ? (
                <Link href="/profile">
                  <Button variant="outline" className="flex items-center space-x-2">
                    <User size={16} />
                    <span>{t("Profile")}</span>
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost">{t("Sign In")}</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="default">{t("Sign Up")}</Button>
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
