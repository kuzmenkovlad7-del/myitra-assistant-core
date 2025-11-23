"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function PrivacyPolicyPage() {
  const { t } = useLanguage()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">{t("Privacy Policy")}</h1>

        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Information We Collect")}</h2>
            <p>{t("Privacy Policy - Information We Collect Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("How We Use Your Information")}</h2>
            <p>{t("Privacy Policy - How We Use Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Data Security")}</h2>
            <p>{t("Privacy Policy - Data Security Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Your Rights")}</h2>
            <p>{t("Privacy Policy - Your Rights Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Contact Us")}</h2>
            <p>{t("Privacy Policy - Contact Description")}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
