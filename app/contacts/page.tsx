"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { Mail, Phone, MapPin } from "lucide-react"
import ContactForm from "@/components/contact-form"

export default function ContactsPage() {
  const { t } = useLanguage()

  const contactInfo = [
    {
      icon: Mail,
      title: t("Email Us"),
      details: "support@myitra.com",
      description: t("For general inquiries and support"),
    },
    {
      icon: Phone,
      title: t("Call Us"),
      details: "+1 (800) 123-4567",
      description: t("Monday to Friday, 9am to 5pm"),
    },
    {
      icon: MapPin,
      title: t("Visit Us"),
      details: t("123 AI Avenue, Tech City"),
      description: t("By appointment only"),
    },
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">{t("Contact Us")}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("Contact Page Description")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {contactInfo.map((item, index) => (
            <div key={index} className="bg-card rounded-2xl shadow-md border border-border p-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">{item.title}</h3>
              <p className="text-primary font-medium mb-2">{item.details}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl shadow-md border border-border p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-foreground">{t("Send Us a Message")}</h2>
          <ContactForm />
        </div>
      </div>
    </div>
  )
}
