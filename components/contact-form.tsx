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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
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
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      })

      if (!res.ok) {
        throw new Error("Failed to submit contact form")
      }

      setIsSubmitted(true)
      setFormState({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    } catch (error) {
      console.error("Error submitting form:", error)
      // при желании можно повесить тост/ошибку
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {isSubmitted ? (
        <div className="rounded-xl bg-indigo-50/80 p-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-indigo-600" />
          <h3 className="mb-2 text-2xl font-bold text-slate-900">
            {t("Thank you for your message!")}
          </h3>
          <p className="mb-4 text-sm text-slate-700">
            {t(
              "We've received your inquiry and will get back to you as soon as possible.",
            )}
          </p>
          <Button
            onClick={() => setIsSubmitted(false)}
            className="rounded-full bg-slate-900 px-6 py-2 text-white hover:bg-slate-800"
          >
            {t("Send another message")}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* поля те же самые */}
          {/* ... код полей без изменений ... */}
        </form>
      )}
    </div>
  )
}
