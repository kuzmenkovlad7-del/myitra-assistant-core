// app/programs/page.tsx
"use client"

import { CheckCircle2, Clock, HeartPulse, Brain } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"

type Program = {
  id: string
  name: string
  tag: string
  description: string
  suitsFor: string[]
  format: string
}

export default function ProgramsPage() {
  const { t } = useLanguage()

  const programs: Program[] = [
    {
      id: "crisis",
      name: t("When it feels bad right now"),
      tag: t("Single support session"),
      descri
