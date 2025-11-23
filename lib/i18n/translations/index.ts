import { en } from "./en"
import { es } from "./es"
import { az } from "./az"
import { ru } from "./ru"
import { de } from "./de"
import { zh } from "./zh"
import { da } from "./da"
import { fr } from "./fr"
import { it } from "./it"
import { ja } from "./ja"
import { ko } from "./ko"
import { pl } from "./pl"
import { pt } from "./pt"
import { sv } from "./sv"
import { tr } from "./tr"
import { uk } from "./uk"
import { vi } from "./vi"

// Define the translations type
export type TranslationsType = Record<string, string>

// Create a map of all translations
const translationsMap: Record<string, TranslationsType> = {
  en,
  es,
  az,
  ru,
  de,
  zh,
  da,
  fr,
  it,
  ja,
  ko,
  pl,
  pt,
  sv,
  tr, // Added Turkish
  uk,
  vi,
}

// Function to get translations for a specific language code
export const getTranslations = (languageCode: string): TranslationsType => {
  return translationsMap[languageCode] || en // Fallback to English
}
