"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface SpeechSynthesisHookOptions {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onSpeechError?: (error: string) => void
}

interface SpeechSynthesisHookReturn {
  speak: (text: string, options?: SpeechSynthesisUtteranceOptions) => Promise<void>
  stop: () => void
  isReady: boolean
  isSupported: boolean
  isSpeaking: boolean
  error: string | null
}

interface SpeechSynthesisUtteranceOptions {
  voice?: SpeechSynthesisVoice
  rate?: number
  pitch?: number
  volume?: number
  lang?: string
}

export function useSpeechSynthesis(options: SpeechSynthesisHookOptions = {}): SpeechSynthesisHookReturn {
  const [isReady, setIsReady] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsReady(true)
      return
    }

    const initializeSpeech = () => {
      try {
        if ("speechSynthesis" in window) {
          setIsSupported(true)

          const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices()
            setVoices(availableVoices)
            setIsReady(true)
            setError(null)
          }

          // Load voices immediately if available
          loadVoices()

          // Also listen for voices changed event (some browsers load voices asynchronously)
          window.speechSynthesis.onvoiceschanged = loadVoices

          // Set a timeout to ensure we're ready even if voices don't load
          timeoutRef.current = setTimeout(() => {
            setIsReady(true)
          }, 1000)
        } else {
          setIsSupported(false)
          setIsReady(true)
          setError("Speech synthesis not supported in this browser")
        }
      } catch (err) {
        console.error("Speech synthesis initialization error:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize speech synthesis")
        setIsReady(true)
      }
    }

    initializeSpeech()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback(
    async (text: string, utteranceOptions: SpeechSynthesisUtteranceOptions = {}): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          if (!isSupported) {
            reject(new Error("Speech synthesis not supported"))
            return
          }

          if (!text.trim()) {
            resolve()
            return
          }

          // Cancel any ongoing speech
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel()
          }

          const utterance = new SpeechSynthesisUtterance(text)
          currentUtteranceRef.current = utterance

          // Set utterance properties
          utterance.rate = utteranceOptions.rate ?? 1
          utterance.pitch = utteranceOptions.pitch ?? 1
          utterance.volume = utteranceOptions.volume ?? 1
          utterance.lang = utteranceOptions.lang ?? "en-US"

          // Find and set voice if specified
          if (utteranceOptions.voice) {
            utterance.voice = utteranceOptions.voice
          } else if (voices.length > 0) {
            // Try to find a voice that matches the language
            const matchingVoice = voices.find((voice) => voice.lang.startsWith(utterance.lang.split("-")[0]))
            if (matchingVoice) {
              utterance.voice = matchingVoice
            }
          }

          utterance.onstart = () => {
            setIsSpeaking(true)
            setError(null)
            options.onSpeechStart?.()
          }

          utterance.onend = () => {
            setIsSpeaking(false)
            currentUtteranceRef.current = null
            options.onSpeechEnd?.()
            resolve()
          }

          utterance.onerror = (event) => {
            setIsSpeaking(false)
            currentUtteranceRef.current = null
            const errorMessage = `Speech synthesis error: ${event.error}`
            setError(errorMessage)
            options.onSpeechError?.(errorMessage)
            reject(new Error(errorMessage))
          }

          window.speechSynthesis.speak(utterance)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Speech synthesis failed"
          setError(errorMessage)
          options.onSpeechError?.(errorMessage)
          reject(new Error(errorMessage))
        }
      })
    },
    [isSupported, voices, options],
  )

  const stop = useCallback(() => {
    try {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
      setIsSpeaking(false)
      currentUtteranceRef.current = null
    } catch (err) {
      console.error("Error stopping speech:", err)
    }
  }, [])

  return {
    speak,
    stop,
    isReady,
    isSupported,
    isSpeaking,
    error,
  }
}
