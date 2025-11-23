"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { generateTranslationTemplate } from "./translation-utils"

export function TranslationExtractor() {
  const [isOpen, setIsOpen] = useState(false)
  const [template, setTemplate] = useState<Record<string, string>>({})

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  const handleExtract = () => {
    const newTemplate = generateTranslationTemplate()
    setTemplate(newTemplate)
    setIsOpen(true)
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Button onClick={handleExtract} className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-lg">
        Extract Translations
      </Button>

      {isOpen && (
        <div className="bg-white border border-gray-300 rounded-md shadow-xl p-4 mt-2 max-h-96 overflow-auto w-96">
          <h3 className="font-bold mb-2">Extracted Translations</h3>
          <div className="text-sm mb-4">
            <p>Found {Object.keys(template).length} translatable strings</p>
          </div>
          <pre className="text-xs bg-gray-100 p-2 rounded max-h-60 overflow-auto">
            {JSON.stringify(template, null, 2)}
          </pre>
          <div className="mt-4 pt-2 border-t border-gray-200 flex justify-between">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(template, null, 2))
                alert("Translation template copied to clipboard!")
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Copy as JSON
            </button>
            <button onClick={() => setIsOpen(false)} className="text-sm text-gray-600 hover:text-gray-800">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
