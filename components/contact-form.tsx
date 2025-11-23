"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/i18n/language-context"
import { Send, CheckCircle } from "lucide-react"

export default function ContactForm() {
  const { t } = useLanguage()
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formState.name.trim()) {
      newErrors.name = t("Name is required")
    }

    if (!formState.email.trim()) {
      newErrors.email = t("Email is required")
    } else if (!/^\S+@\S+\.\S+$/.test(formState.email)) {
      newErrors.email = t("Please enter a valid email address")
    }

    if (!formState.subject.trim()) {
      newErrors.subject = t("Subject is required")
    }

    if (!formState.message.trim()) {
      newErrors.message = t("Message is required")
    } else if (formState.message.length < 10) {
      newErrors.message = t("Message must be at least 10 characters")
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      // Здесь потом легко заменить на реальный API-запрос
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setIsSubmitted(true)
      setFormState({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {isSubmitted ? (
        <div className="rounded-xl bg-primary/10 p-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-primary" />
          <h3 className="mb-2 text-2xl font-bold text-primary">
            {t("Thank you for your message!")}
          </h3>
          <p className="mb-4 text-foreground">
            {t("We've received your inquiry and will get back to you as soon as possible.")}
          </p>
          <Button
            onClick={() => setIsSubmitted(false)}
            className="rounded-full bg-primary-600 px-6 py-2 text-white hover:bg-primary-700"
          >
            {t("Send another message")}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              {t("Your Name")} <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              name="name"
              value={formState.name}
              onChange={handleChange}
              placeholder={t("Enter your full name")}
              className={errors.name ? "border-red-500" : "border-gray-300"}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="mt-1 text-sm text-red-600">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              {t("Email Address")} <span className="text-red-500">*</span>
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formState.email}
              onChange={handleChange}
              placeholder={t("Enter your email address")}
              className={errors.email ? "border-red-500" : "border-gray-300"}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
              {t("Subject")} <span className="text-red-500">*</span>
            </label>
            <Input
              id="subject"
              name="subject"
              value={formState.subject}
              onChange={handleChange}
              placeholder={t("Enter the subject of your message")}
              className={errors.subject ? "border-red-500" : "border-gray-300"}
              aria-invalid={!!errors.subject}
              aria-describedby={errors.subject ? "subject-error" : undefined}
            />
            {errors.subject && (
              <p id="subject-error" className="mt-1 text-sm text-red-600">
                {errors.subject}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-700">
              {t("Your Message")} <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="message"
              name="message"
              value={formState.message}
              onChange={handleChange}
              placeholder={t("Type your message here...")}
              rows={6}
              className={`${errors.message ? "border-red-500" : "border-gray-300"} resize-none`}
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "message-error" : undefined}
            />
            {errors.message && (
              <p id="message-error" className="mt-1 text-sm text-red-600">
                {errors.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-full bg-slate-900 px-8 py-6 text-lg text-white hover:bg-slate-800"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("Sending...")}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  {t("Send Message")}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
