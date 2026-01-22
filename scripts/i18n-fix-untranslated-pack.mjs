import fs from "fs"
import path from "path"

const files = {
  en: "lib/i18n/translations/en.ts",
  uk: "lib/i18n/translations/uk.ts",
  ru: "lib/i18n/translations/ru.ts",
}

function esc(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
}

function patchByKey(fileRel, key, val) {
  const file = path.resolve(process.cwd(), fileRel)
  const before = fs.readFileSync(file, "utf8")
  const re = new RegExp(`"${esc(key)}"\\s*:\\s*"[^"]*"`)
  if (!re.test(before)) return false
  const after = before.replace(re, `"${key}": "${val}"`)
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8")
    return true
  }
  return false
}

const PACK = [
  {
    key: "• Answers are based on selected psychological books and materials that were tested with a specialist.",
    en: "• Answers are based on carefully selected well-being materials reviewed by experts.",
    uk: "• Відповіді ґрунтуються на добірці книжок і матеріалів з емоційної підтримки, які ми перевіряли разом із експертом.",
    ru: "• Ответы основаны на подборке материалов для эмоциональной поддержки, которые мы проверяли вместе с экспертом.",
  },
  {
    key: "• The assistant is a supportive tool that can live alongside individual or group support.",
    en: "• The assistant is a supportive tool that can complement your personal support.",
    uk: "• Асистент — це підтримувальний інструмент, який може доповнювати вашу особисту підтримку.",
    ru: "• Ассистент — это поддерживающий инструмент, который может дополнять вашу личную поддержку.",
  },
  {
    key: "• TurbotaAI is not a specialist and not a specialist.",
    en: "• TurbotaAI is a supportive service, not medical care.",
    uk: "• TurbotaAI створений для підтримки та розмов і не замінює професійну допомогу.",
    ru: "• TurbotaAI создан для поддержки и разговоров и не заменяет профессиональную помощь.",
  },
  {
    key: "AI Companion Video Call",
    en: "AI companion video call",
    uk: "Відеорозмова з AI співрозмовником",
    ru: "Видеозвонок с AI собеседником",
  },
  {
    key: "AI emotional support",
    en: "AI emotional support",
    uk: "Емоційна підтримка з AI",
    ru: "Эмоциональная поддержка с AI",
  },
  {
    key: "Choose Your AI Companion",
    en: "Choose Your AI Companion",
    uk: "Обирайте свого AI співрозмовника",
    ru: "Выберите своего AI собеседника",
  },
  {
    key: "Clinical specialist specializing in anxiety, depression, and workplace stress management",
    en: "AI companion for anxiety, stress, and overload",
    uk: "AI співрозмовник для тривоги, стресу та перевантаження",
    ru: "AI собеседник для тревоги, стресса и перегрузки",
  },
  {
    key: "emotional support based on AI for everyday emotional difficulties.",
    en: "Emotional support powered by AI for everyday difficulties.",
    uk: "Емоційна підтримка на основі AI для щоденних труднощів.",
    ru: "Эмоциональная поддержка на основе AI для повседневных трудностей.",
  },
  {
    key: "emotional support when it feels hard, powered by AI",
    en: "Emotional support when it feels hard, powered by AI",
    uk: "Емоційна підтримка, коли важко, з AI",
    ru: "Эмоциональная поддержка, когда тяжело, с AI",
  },
  {
    key: "FEMALE VOICE",
    en: "Female voice",
    uk: "ЖІНОЧИЙ ГОЛОС",
    ru: "ЖЕНСКИЙ ГОЛОС",
  },
  {
    key: "MALE VOICE",
    en: "Male voice",
    uk: "ЧОЛОВІЧИЙ ГОЛОС",
    ru: "МУЖСКОЙ ГОЛОС",
  },
  {
    key: "First steps in support & anxiety",
    en: "First steps in calm support",
    uk: "Перші кроки у підтримці та тривозі",
    ru: "Первые шаги в поддержке и тревоге",
  },
  {
    key: "Licensed specialists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.",
    en: "Support tools powered by AI. We help you reflect, keep notes, and stay on track.",
    uk: "Інструменти підтримки на основі AI. Допомагаємо структурувати думки, вести нотатки та тримати фокус.",
    ru: "Инструменты поддержки на основе AI. Помогаем структурировать мысли, вести заметки и держать фокус.",
  },
  {
    key: "Live emotional support,",
    en: "Live emotional support,",
    uk: "Жива емоційна підтримка,",
    ru: "Живая эмоциональная поддержка,",
  },
  {
    key: "Press the button to start the call. Allow microphone access, then speak as if with a real specialist.",
    en: "Press the button to start the call. Allow microphone access, then speak as if with a calm companion.",
    uk: "Натисніть кнопку, щоб розпочати розмову. Дозвольте доступ до мікрофона й говоріть так, ніби поруч спокійний співрозмовник.",
    ru: "Нажмите кнопку, чтобы начать разговор. Разрешите доступ к микрофону и говорите так, будто рядом спокойный собеседник.",
  },
  {
    key: "Select the AI companion you'd like to speak with during your video call.",
    en: "Select the AI companion you'd like to speak with during your video call.",
    uk: "Оберіть AI співрозмовника, з яким хочете поспілкуватися під час відеодзвінка.",
    ru: "Выберите AI собеседника, с которым хотите поговорить во время видеозвонка.",
  },
  {
    key: "Senior specialist specializing in cognitive behavioral support with 15+ years of experience",
    en: "Senior AI companion for deeper conversations (15+ years of approach practice)",
    uk: "Старший AI співрозмовник для глибших розмов (15+ років практики підходів)",
    ru: "Старший AI собеседник для более глубоких разговоров (15+ лет практики подходов)",
  },
  {
    key: "TurbotaAI — AI companion that stays nearby when it feels hard",
    en: "TurbotaAI — an AI companion that stays nearby when it feels hard",
    uk: "TurbotaAI — AI співрозмовник, який поруч, коли важко",
    ru: "TurbotaAI — AI собеседник рядом, когда тяжело",
  },
  {
    key: "TurbotaAI is not a replacement for a licensed specialist or specialist.",
    en: "TurbotaAI is not a replacement for professional help.",
    uk: "TurbotaAI не замінює професійну допомогу.",
    ru: "TurbotaAI не заменяет профессиональную помощь.",
  },
  {
    key: "TurbotaAI is not an emergency service and does not replace consultations with a specialist, specialist or other licensed healthcare professional. If you are in danger or may harm yourself or others, you must immediately contact emergency services or a human specialist.",
    en: "TurbotaAI is not an emergency service and does not replace professional help. If you are in danger or may harm yourself or others, contact local emergency services immediately.",
    uk: "TurbotaAI не є екстреною службою та не замінює професійну допомогу. Якщо ви в небезпеці або можете завдати шкоди собі чи іншим, негайно зверніться до служб екстреної допомоги.",
    ru: "TurbotaAI не является экстренной службой и не заменяет профессиональную помощь. Если вы в опасности или можете причинить вред себе или другим, немедленно обратитесь в экстренные службы.",
  },
  {
    key: "TurbotaAI provides AI-based emotional support tools. The Service is not a medical facility and does not provide services that qualify as medical or psychiatric treatment.",
    en: "TurbotaAI provides AI-based emotional support tools. The Service is not a medical facility and does not provide healthcare services.",
    uk: "TurbotaAI надає інструменти емоційної підтримки на основі AI. Сервіс не є медичним закладом і не надає медичних послуг.",
    ru: "TurbotaAI предоставляет инструменты эмоциональной поддержки на основе AI. Сервис не является медицинским учреждением и не оказывает медицинские услуги.",
  },
]

let ok = 0
for (const row of PACK) {
  ok += patchByKey(files.en, row.key, row.en) ? 1 : 0
  ok += patchByKey(files.uk, row.key, row.uk) ? 1 : 0
  ok += patchByKey(files.ru, row.key, row.ru) ? 1 : 0
}

console.log("OK patched entries:", ok)
