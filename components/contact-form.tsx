"use client"

import { useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

type ContactFormState = {
  name: string
  email: string
  company: string
  message: string
}

const initialState: ContactFormState = {
  name: "",
  email: "",
  company: "",
  message: "",
}

export default function ContactForm() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [form, setForm] = useState<ContactFormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange =
    (field: keyof ContactFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setForm((prev) => ({ ...prev, [field]: value }))
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      toast({
        title: t("Message sent"),
        description: t("We will get back to you as soon as possible."),
      })

      setForm(initialState)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: t("Failed to send message"),
        description: t("Please try again in a few minutes."),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("Your name")}
          </label>
          <Input
            value={form.name}
            onChange={handleChange("name")}
            placeholder={t("How can we address you?")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t("Company (optional)")}
          </label>
          <Input
            value={form.company}
            onChange={handleChange("company")}
            placeholder={t("Clinic, practice or project name")}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t("Your email")}
        </label>
        <Input
          type="email"
          required
          value={form.email}
          onChange={handleChange("email")}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t("Your message")}
        </label>
        <Textarea
          required
          rows={4}
          value={form.message}
          onChange={handleChange("message")}
          placeholder={t("Briefly describe your request or idea.")}
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full md:w-auto bg-primary-600 hover:bg-primary-700"
      >
        {isSubmitting ? t("Sending...") : t("Send message")}
      </Button>
    </form>
  )
}
