"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export default function ProgramsPage() {
  const { t } = useLanguage()

  const programs = [
    {
      title: t("Single Session"),
      price: "Program Price - Single",
      features: [
        t("One-time consultation"),
        t("All communication modes"),
        t("Session recording"),
      ],
    },
    {
      title: t("Monthly Subscription"),
      price: t("Program Price - Monthly"),
      features: [
        t("Unlimited sessions"),
        t("Priority support"),
        t("Progress tracking"),
        t("Personalized recommendations"),
      ],
      popular: true,
    },
    {
      title: t("Corporate Program"),
      price: "Program Price - Corporate",
      features: [
        t("Team access"),
        t("Admin dashboard"),
        t("Custom integrations"),
        t("Dedicated support"),
      ],
    },
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">{t("Our Programs")}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("Programs Page Description")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {programs.map((program, index) => (
            <div
              key={index}
              className={`bg-card rounded-2xl shadow-md border p-8 relative ${
                program.popular ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border"
              }`}
            >
              {program.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  {t("Popular")}
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2 text-foreground">{program.title}</h3>
              <p className="text-3xl font-bold text-primary mb-6">{program.price}</p>
              <ul className="space-y-3 mb-8">
                {program.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full">{t("Choose Program")}</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
