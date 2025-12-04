// @ts-nocheck
import { getTranslations } from "./translations"
import { languages } from "./languages"
import { validateTranslations } from "./translation-utils"

export class TranslationManager {
  private static instance: TranslationManager
  private translationCache = new Map<string, Record<string, string>>()
  private missingTranslations = new Map<string, Set<string>>()

  private constructor() {}

  static getInstance(): TranslationManager {
    if (!TranslationManager.instance) {
      TranslationManager.instance = new TranslationManager()
    }
    return TranslationManager.instance
  }

  // Preload translations for better performance
  preloadTranslations(languageCodes: string[] = []): void {
    const codesToLoad = languageCodes.length > 0 ? languageCodes : languages.map((lang) => lang.code)

    codesToLoad.forEach((code) => {
      if (!this.translationCache.has(code)) {
        try {
          const translations = getTranslations(code)
          this.translationCache.set(code, translations)
        } catch (error) {
          console.warn(`Failed to preload translations for ${code}:`, error)
        }
      }
    })
  }

  // Get cached translations
  getTranslations(languageCode: string): Record<string, string> {
    if (!this.translationCache.has(languageCode)) {
      const translations = getTranslations(languageCode)
      this.translationCache.set(languageCode, translations)
    }
    return this.translationCache.get(languageCode) || {}
  }

  // Clear translation cache
  clearCache(): void {
    this.translationCache.clear()
    this.missingTranslations.clear()
  }

  // Record missing translation
  recordMissingTranslation(languageCode: string, key: string): void {
    if (!this.missingTranslations.has(languageCode)) {
      this.missingTranslations.set(languageCode, new Set())
    }
    this.missingTranslations.get(languageCode)?.add(key)
  }

  // Get missing translations for a language
  getMissingTranslations(languageCode: string): string[] {
    return Array.from(this.missingTranslations.get(languageCode) || [])
  }

  // Get translation coverage report
  getCoverageReport(): Record<string, { coverage: number; missing: number; total: number }> {
    const report: Record<string, { coverage: number; missing: number; total: number }> = {}

    languages.forEach((lang) => {
      const validation = validateTranslations(lang.code)
      report[lang.code] = {
        coverage: validation.coverage,
        missing: validation.missing.length,
        total: validation.total,
      }
    })

    return report
  }

  // Export missing translations for translation services
  exportMissingTranslations(): Record<string, string[]> {
    const exported: Record<string, string[]> = {}

    this.missingTranslations.forEach((missing, languageCode) => {
      exported[languageCode] = Array.from(missing)
    })

    return exported
  }

  // Batch translate multiple keys
  batchTranslate(keys: string[], languageCode: string): Record<string, string> {
    const translations = this.getTranslations(languageCode)
    const result: Record<string, string> = {}

    keys.forEach((key) => {
      result[key] = translations[key] || key
      if (!translations[key]) {
        this.recordMissingTranslation(languageCode, key)
      }
    })

    return result
  }

  // Get translation statistics
  getStatistics(): {
    totalLanguages: number
    totalTranslations: number
    averageCoverage: number
    languagesWithFullCoverage: number
  } {
    const report = this.getCoverageReport()
    const coverages = Object.values(report).map((r) => r.coverage)

    return {
      totalLanguages: languages.length,
      totalTranslations: Object.values(report).reduce((sum, r) => sum + r.total, 0),
      averageCoverage: coverages.reduce((sum, c) => sum + c, 0) / coverages.length,
      languagesWithFullCoverage: coverages.filter((c) => c === 100).length,
    }
  }
}

// Export singleton instance
export const translationManager = TranslationManager.getInstance()
