"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { Facebook, Twitter, Instagram, Linkedin, Mail } from "lucide-react"

export default function Footer() {
  const { t } = useLanguage()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-primary-950 text-lavender-200 py-12 px-4 md:px-6 lg:px-8 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold mb-4 text-white">AI Psychology Support</h3>
            <p className="mb-4 text-lavender-300 max-w-md">
              {t(
                "Providing AI-powered psychological support in multiple languages to help you navigate life's challenges.",
              )}
            </p>
            <div className="flex space-x-4 mt-6">
              <a href="#" className="text-lavender-300 hover:text-white transition-colors">
                <Facebook size={20} />
                <span className="sr-only">Facebook</span>
              </a>
              <a href="#" className="text-lavender-300 hover:text-white transition-colors">
                <Twitter size={20} />
                <span className="sr-only">Twitter</span>
              </a>
              <a href="#" className="text-lavender-300 hover:text-white transition-colors">
                <Instagram size={20} />
                <span className="sr-only">Instagram</span>
              </a>
              <a href="#" className="text-lavender-300 hover:text-white transition-colors">
                <Linkedin size={20} />
                <span className="sr-only">LinkedIn</span>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">{t("Quick Links")}</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-lavender-300 hover:text-white transition-colors">
                  {t("Home")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-lavender-300 hover:text-white transition-colors">
                  {t("About")}
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-lavender-300 hover:text-white transition-colors">
                  {t("Services")}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-lavender-300 hover:text-white transition-colors">
                  {t("Pricing")}
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="text-lavender-300 hover:text-white transition-colors">
                  {t("Contact")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">{t("Contact Us")}</h4>
            <ul className="space-y-2">
              <li className="flex items-start">
                <Mail size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                <span>support@aipsychologist.com</span>
              </li>
              <li>
                <p>{t("123 AI Avenue")}</p>
                <p>{t("Tech City, TC 12345")}</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-lavender-400">
            &copy; {currentYear} AI Psychology Support. {t("All rights reserved.")}
          </p>
          <div className="mt-4 sm:mt-0 flex space-x-4 text-sm">
            <Link href="/privacy" className="text-lavender-400 hover:text-white transition-colors">
              {t("Privacy Policy")}
            </Link>
            <Link href="/terms" className="text-lavender-400 hover:text-white transition-colors">
              {t("Terms of Service")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
