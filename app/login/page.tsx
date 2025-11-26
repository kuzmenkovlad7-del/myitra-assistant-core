// app/login/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const { t } = useLanguage()
  const router = useRouter()

  return (
    <div className="min-h-[calc(100vh-96px)] flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-slate-100 px-6 py-8 md:px-8 md:py-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-slate-900">
            TurbotaAI
          </h1>
          <p className="text-sm text-slate-500">
            {t(
              "During the testing phase you can use the platform without creating an account.",
            )}
          </p>
        </div>

        <div className="space-y-3 text-sm text-slate-600 mb-6">
          <p>
            {t(
              "Now you can start a chat, voice call or video session with the AI-psychologist directly from the main page.",
            )}
          </p>
          <p>
            {t(
              "Later this page will be used for full registration, saving programs and personal settings.",
            )}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/")}
          className="w-full h-11 rounded-full bg-primary-600 text-white hover:bg-primary-700"
        >
          {t("Back to main page")}
        </Button>
      </div>
    </div>
  )
}
