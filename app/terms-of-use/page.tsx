"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function TermsOfUsePage() {
  const { t } = useLanguage()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">{t("Terms of Use")}</h1>

        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Acceptance of Terms")}</h2>
            <p>{t("Terms - Acceptance Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Use of Services")}</h2>
            <p>{t("Terms - Use of Services Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("User Responsibilities")}</h2>
            <p>{t("Terms - User Responsibilities Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Limitation of Liability")}</h2>
            <p>{t("Terms - Limitation of Liability Description")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Changes to Terms")}</h2>
            <p>{t("Terms - Changes Description")}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
