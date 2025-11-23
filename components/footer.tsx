"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { Facebook, Twitter, Instagram, Linkedin, Mail } from "lucide-react"
import Logo from "./logo"

export default function Footer() {
  const { t } = useLanguage()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="container mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Левая колонка: логотип + описание + предупреждение */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-lg font-semibold text-slate-900">
                Myitra
              </span>
            </div>

            <p className="mt-4 max-w-md text-sm text-slate-600">
              {t(
                "Psychological support based on AI for everyday emotional difficulties.",
              )}
            </p>

            <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs sm:text-sm text-slate-700">
              <p className="font-semibold text-violet-900">
                {t("This is not an emergency service")}
              </p>
              <p className="mt-1">
                {t(
                  "Myitra is not a replacement for a licensed psychologist or psychiatrist.",
                )}
              </p>
              <p className="mt-1">
                {t(
                  "If you are in immediate danger, please contact local emergency services or a crisis hotline in your region.",
                )}
              </p>
            </div>
          </div>

          {/* Средняя колонка: быстрые ссылки */}
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4">
              {t("Quick Links")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-slate-600 hover:text-slate-900 transition-colors no-underline hover:no-underline"
                >
                  {t("Home")}
                </Link>
              </li>
              <li>
                <Link
                  href="/programs"
                  className="text-slate-600 hover:text-slate-900 transition-colors no-underline hover:no-underline"
                >
                  {t("Programs")}
                </Link>
              </li>
              <li>
                <Link
                  href="/client-stories"
                  className="text-slate-600 hover:text-slate-900 transition-colors no-underline hover:no-underline"
                >
                  {t("Client Stories")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contacts"
                  className="text-slate-600 hover:text-slate-900 transition-colors no-underline hover:no-underline"
                >
                  {t("Contacts")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Правая колонка: контакты + соцсети */}
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4">
              {t("Contact Us")}
            </h4>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start">
                <Mail
                  size={18}
                  className="mr-2 mt-0.5 flex-shrink-0 text-slate-500"
                />
                <span>support@myitra.com</span>
              </li>
              <li>
                <p>{t("Online psychological support platform")}</p>
              </li>
            </ul>

            <div className="mt-4 flex space-x-4">
              <a
                href="#"
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                <span className="sr-only">Facebook</span>
                <Facebook size={20} />
              </a>
              <a
                href="#"
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                <span className="sr-only">Twitter</span>
                <Twitter size={20} />
              </a>
              <a
                href="#"
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                <span className="sr-only">Instagram</span>
                <Instagram size={20} />
              </a>
              <a
                href="#"
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                <span className="sr-only">LinkedIn</span>
                <Linkedin size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-500">
          <p>
            &copy; {currentYear} Myitra. {t("All rights reserved.")}
          </p>
          <div className="flex gap-4">
            <Link
              href="/privacy-policy"
              className="hover:text-slate-900 transition-colors no-underline hover:no-underline"
            >
              {t("Privacy Policy")}
            </Link>
            <Link
              href="/terms-of-use"
              className="hover:text-slate-900 transition-colors no-underline hover:no-underline"
            >
              {t("Terms of Use")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
