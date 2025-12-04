// @ts-nocheck
"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import {
  getLocaleForLanguage,
  getNativeVoicePreferences,
  getNativeSpeechParameters,
  formatTextForSpeech,
} from "@/lib/i18n/translation-utils"
import { generateGoogleTTS, shouldUseGoogleTTS } from "@/lib/google-tts"

interface VoiceConfig {
  language: string
  gender: "male" | "female"
  rate?: number
  pitch?: number
  volume?: number
}

interface UseEnhancedSpeechSynthesisOptions {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onSpeechError?: (error: string) => void
}

// Dr. Alexander's Google Cloud TTS credentials for enhanced speech synthesis
const GOOGLE_TTS_CREDENTIALS = {
  type: "service_account",
  project_id: "strong-maker-471022-s6",
  private_key_id: "dc48898af9911d21c7959fd5b13bb28db7ea1354",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCuFvlHiJgmSpjv\n9stiMzxxidgqxcN2/ralj7zgkkjXXhOgikfeOhBpjvjBeLDgLxNynA7DjoQ8wHbf\ngdrRuCqnrg83NC/FXTLHDRXXLW+megwcNLu3Kl7gR7q8iABBw1FaZxFnjduejnti\nAxL3ZQnAFB9Uw2U9bQBh2TejD225TEJnyqiuecVD9pkAZE8aeN5ZgPnljLMjzkfk\njKSeZMU+2kHdcs4YCQ4ShNG2C7eL7mWsj1RpG9KKnOlkMlaZ8noM++pO4q7mCzc5\nDOUDv9gpCXKG1324KgZug1k3KN9jlyTdGs7r/MFcUHFRNWUOpCMdxkIdPLRMlWJT\nlF7uQabxAgMBAAECggEABbY6wRJV/aGicXMdOrBYKhh9929MKb4TM4zrA0pBahGL\n3s9SqtOoYLJAbqadVQmuX2sH3/ov1AdzjwNFcO6UNbK0DJlhfN4BMb836Xqz6Fgm\nSBGh3BFfkgfAdHmY2o+EPo1VqJpiq4ncuftEVsohnwP6AC+2BWUrZ0p3dRnnPXZZ\nad02aThfaG73awScY5T0rotCIlq5M2z748EoBKHPUKELFunq5EiPiQfSIynO/Gpm\nayNtJ8OH8eQXNEnr5ixa/lo3L3g8w2cA+DnMTrFX1UGsbgoGgbY9/8c4bSEAcjUA\na6U8NxTb9jqjDcnIeXmG6XW3Qhhu385EwqvGQSg4HQKBgQDm2AQfF/RKkjbKworS\nXZfaBVgsMqR7pkqnOX54Fr/Y0mkdY6qjh4rG+OBo2GHLn+VRLSbWVSmpy962cZWo\nXHdi9n4rMSXApxLoYdb9pNeYrNO6uxxC+DM7R2tTI8J6LtyuTEsw9s/AOYkP/Skf\nUswHgqexqpZ3pAnZS3Ova7njRQKBgQDBD6gGwOa7krhpfgwJnhd7ver+Bar8VN1E\n2QFnCpETx2NGtZtOKwD2k+Zn+Y8dv/+TSaSj6kERgjqDBvSj/XU8kNN2Wdc22nwW\nnnLTo2fusaKpZP3OWdgNUMv7cC7RKjK5ZecO0JZGRF7f+6N4zs2707cbxAf0qR+S\nzTDbNii5vQKBgQCWe0bkhhcH7ZyuPHeGfuCYjVdXKIQ03shXjpE084+IZlGDiQ8Z\nnygGYQLZFgVaWheA/XAN1GJef7nlMNIgeHaTGqBQw68akU8wEWe23Rh2PGOhnIvl\n1CqBgCMkhXEneRj+vlldx+bSJi+FLsD53F2In9F1bgC8aUDKV/dH6W+6CQKBgQCy\nA4quN35JJH9QHj5hO9lxauvcMEO6CVJBYkrtxQuCjk4W6+t5ByQLONKxuqXhC6FQ\nIQ5jaeN3jnn/SRGYiGNqZivlq+9Kj+jtPkqopLp3mGlhAlMYyzTxCjgb7xPsH5nH\n45NK0MBPqElHBBN2mFGRSCVFv9qKGMuZJARRjL2+jQKBgQDVV50qRixSs2PkfbQa\n+NsCz16EHBFTz8mGkPtNZtWB2eZUK3toxmDw+iZormjPN8IxdgVjUmH4nA+PVMg9\nzcg+vXDBQlkD+lr3LDxi6vWfThbC1aY8W34qCjPBFYYPGH8W8sWUMSi388I5P3cI\ntI/Wlzv7csphuz620VfkkJlHjw==\n-----END PRIVATE KEY-----\n",
  client_email: "tts-service-1@strong-maker-471022-s6.iam.gserviceaccount.com",
  client_id: "103107984061473463379",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/tts-service-1%40strong-maker-471022-s6.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
}

// Voice configurations - Female uses Dr. Alexander's voice, Male uses Standard Ukrainian
const VOICE_CONFIGS = {
  uk: {
    female: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar", // Dr. Alexander's voice for female
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Standard-A", // Standard Ukrainian voice for male
      ssmlGender: "MALE",
    },
  },
}

export function useEnhancedSpeechSynthesis({
  onSpeechStart,
  onSpeechEnd,
  onSpeechError,
}: UseEnhancedSpeechSynthesisOptions = {}) {
  const { currentLanguage } = useLanguage()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [queueLength, setQueueLength] = useState(0)

  // Refs for managing speech state
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const speechQueueRef = useRef<string[]>([])
  const isProcessingRef = useRef(false)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())
  const lastSpokenTextRef = useRef<string>("")

  // Get native voice preferences
  const nativeVoicePreferences = getNativeVoicePreferences()

  // Enhanced voice selection with comprehensive native accent support
  const getRefinedVoiceForLanguage = useCallback(
    (langCode: string, preferredGender: "female" | "male" = "female"): SpeechSynthesisVoice | null => {
      if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported")
        return null
      }

      const cacheKey = `${langCode}-${preferredGender}`

      // Return cached voice if available
      if (voiceCacheRef.current.has(cacheKey)) {
        const cachedVoice = voiceCacheRef.current.get(cacheKey)!
        console.log(`✓ Using cached native voice: ${cachedVoice.name} for ${langCode} ${preferredGender}`)
        return cachedVoice
      }

      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        console.warn("No voices available yet, will retry when voices load")
        return null
      }

      console.log(`🎯 Finding native voice for ${langCode} ${preferredGender} from ${voices.length} voices`)

      // Get native voice preferences for this language and gender
      const nativeVoices = nativeVoicePreferences[langCode]?.[preferredGender] || []

      // Phase 1: Try exact matches from native preferences (HIGHEST PRIORITY)
      for (const voiceName of nativeVoices) {
        const exactMatch = voices.find((v) => v.name === voiceName)
        if (exactMatch) {
          console.log(`✅ NATIVE exact match: ${exactMatch.name} for ${langCode} ${preferredGender}`)
          voiceCacheRef.current.set(cacheKey, exactMatch)
          return exactMatch
        }
      }

      // Phase 2: Try partial matches from native preferences
      for (const voiceName of nativeVoices) {
        const partialMatch = voices.find(
          (v) =>
            v.name.includes(voiceName) ||
            voiceName.includes(v.name) ||
            v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
            voiceName.toLowerCase().includes(v.name.toLowerCase()),
        )
        if (partialMatch) {
          console.log(
            `✅ NATIVE partial match: ${partialMatch.name} (target: ${voiceName}) for ${langCode} ${preferredGender}`,
          )
          voiceCacheRef.current.set(cacheKey, partialMatch)
          return partialMatch
        }
      }

      // Phase 3: Enhanced language-based search with native accent scoring
      const getLanguageVoices = (lang: string) => {
        const langLower = lang.toLowerCase()
        return voices.filter((v) => {
          const voiceLang = v.lang.toLowerCase()
          const voiceName = v.name.toLowerCase()

          // Direct language code match
          if (voiceLang.startsWith(langLower)) return true
          if (voiceLang.includes(`${langLower}-`)) return true

          // Specific language matching with native name recognition
          if (lang === "ru") {
            return (
              voiceLang.includes("ru-") ||
              voiceName.includes("русский") ||
              voiceName.includes("russian") ||
              voiceName.includes("irina") ||
              voiceName.includes("pavel") ||
              voiceName.includes("dmitry") ||
              voiceName.includes("aleksandr") ||
              voiceName.includes("svetlana") ||
              voiceName.includes("dariya") ||
              voiceName.includes("ekaterina") ||
              voiceName.includes("boris")
            )
          }
          if (lang === "uk") {
            return voiceLang.includes("uk-") || voiceName.includes("українська") || voiceName.includes("ukrainian")
          }
          if (lang === "en") {
            return (
              voiceLang.includes("en-") ||
              voiceName.includes("english") ||
              voiceName.includes("zira") ||
              voiceName.includes("david") ||
              voiceName.includes("samantha") ||
              voiceName.includes("alex")
            )
          }

          return false
        })
      }

      const langVoices = getLanguageVoices(langCode)

      if (langVoices.length > 0) {
        // Advanced scoring system for native accent authenticity
        const scoredVoices = langVoices.map((voice) => {
          let score = 10 // Base score

          const lowerName = voice.name.toLowerCase()
          const lowerLang = voice.lang.toLowerCase()

          // Gender matching (high priority for native accent)
          const genderHints =
            preferredGender === "female"
              ? [
                  "female",
                  "woman",
                  "girl",
                  "f)",
                  "женский",
                  "жіночий",
                  "zira",
                  "irina",
                  "samantha",
                  "svetlana",
                  "dariya",
                  "ekaterina",
                  "elena",
                  "katya",
                  "oksana",
                  "milena",
                ]
              : [
                  "male",
                  "man",
                  "boy",
                  "m)",
                  "мужской",
                  "чоловічий",
                  "david",
                  "alex",
                  "pavel",
                  "dmitry",
                  "aleksandr",
                  "boris",
                  "maxim",
                  "sergey",
                ]

          if (genderHints.some((hint) => lowerName.includes(hint))) {
            score += 40 // Higher bonus for gender match in native voices
          }

          // Native voice technology bonuses
          if (lowerName.includes("neural")) score += 30 // Neural voices for native accent
          if (lowerName.includes("wavenet")) score += 25 // Wavenet for natural speech
          if (lowerName.includes("premium")) score += 22
          if (lowerName.includes("enhanced")) score += 20
          if (lowerName.includes("professional")) score += 18
          if (lowerName.includes("therapeutic")) score += 18
          if (lowerName.includes("natural")) score += 15

          // Provider quality bonuses for native accent
          if (lowerName.includes("google")) score += 20
          if (lowerName.includes("microsoft")) score += 18
          if (lowerName.includes("yandex") && langCode === "ru") score += 25 // Yandex excels at Russian

          // Specific native voice bonuses
          const nativeVoiceNames = [
            "svetlana",
            "dariya",
            "ekaterina",
            "dmitry",
            "aleksandr",
            "boris",
            "irina",
            "pavel",
            "русский",
            "russian",
            "українська",
            "ukrainian",
          ]
          if (nativeVoiceNames.some((nv) => lowerName.includes(nv))) {
            score += 45 // Very high bonus for native voices
          }

          // Language match bonus
          if (lowerLang.startsWith(langCode.toLowerCase())) {
            score += 20
          }

          // Voice service quality indicators
          if (!voice.default) score += 12
          if (voice.localService) score += 10

          return { voice, score }
        })

        scoredVoices.sort((a, b) => b.score - a.score)
        const bestVoice = scoredVoices[0].voice

        console.log(
          `✅ NATIVE language fallback: ${bestVoice.name} (score: ${scoredVoices[0].score}) for ${langCode} ${preferredGender}`,
        )
        voiceCacheRef.current.set(cacheKey, bestVoice)
        return bestVoice
      }

      // Phase 4: Cross-language fallbacks with native preference
      console.warn(`⚠️ No ${langCode} voices found, using cross-language native fallbacks`)

      if (langCode === "uk") {
        // Ukrainian fallback to Russian (similar accent)
        const russianVoice = getRefinedVoiceForLanguage("ru", preferredGender)
        if (russianVoice) {
          console.log(`✅ Using NATIVE Russian voice for Ukrainian ${preferredGender}: ${russianVoice.name}`)
          voiceCacheRef.current.set(cacheKey, russianVoice)
          return russianVoice
        }
      }

      // Ultimate fallback to English
      if (langCode !== "en") {
        const englishVoice = getRefinedVoiceForLanguage("en", preferredGender)
        if (englishVoice) {
          console.log(`✅ Using NATIVE English voice for ${langCode} ${preferredGender}: ${englishVoice.name}`)
          voiceCacheRef.current.set(cacheKey, englishVoice)
          return englishVoice
        }
      }

      // Last resort - any available voice
      if (voices.length > 0) {
        const lastResortVoice = voices[0]
        console.log(`⚠️ Last resort voice for ${langCode} ${preferredGender}: ${lastResortVoice.name}`)
        voiceCacheRef.current.set(cacheKey, lastResortVoice)
        return lastResortVoice
      }

      console.error(`❌ No voices available at all for ${langCode} ${preferredGender}`)
      return null
    },
    [nativeVoicePreferences],
  )

  // Enhanced speak function with Google TTS for Ukrainian/Russian
  const speak = useCallback(
    async (text: string, config?: VoiceConfig): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        if (!text || !text.trim()) {
          resolve()
          return
        }

        // Prevent duplicate speech
        const cleanedText = formatTextForSpeech(text)
        if (cleanedText === lastSpokenTextRef.current) {
          console.log("Skipping duplicate speech:", cleanedText.substring(0, 50))
          resolve()
          return
        }

        lastSpokenTextRef.current = cleanedText

        // Configure language and voice
        const languageCode = config?.language || currentLanguage.code
        const gender = config?.gender || "female"

        console.log(`🎤 Speech synthesis for ${languageCode} with ${gender} voice`)

        // Set speaking state
        setIsSpeaking(true)
        onSpeechStart?.()

        try {
          // Use Google TTS for Ukrainian and Russian
          if (shouldUseGoogleTTS(languageCode)) {
            console.log(`🎤 Using Google TTS for ${languageCode} ${gender}`)

            try {
              const audioDataUrl = await generateGoogleTTS(
                cleanedText,
                languageCode,
                gender,
                GOOGLE_TTS_CREDENTIALS,
                VOICE_CONFIGS,
              )

              // Create audio element for playback
              const audio = new Audio(audioDataUrl)
              currentAudioRef.current = audio

              audio.onended = () => {
                console.log(`✅ Google TTS finished speaking in ${languageCode} ${gender}`)
                setIsSpeaking(false)
                currentAudioRef.current = null
                onSpeechEnd?.()
                resolve()
              }

              audio.onerror = (error) => {
                console.error(`❌ Google TTS audio error for ${languageCode} ${gender}:`, error)
                setIsSpeaking(false)
                currentAudioRef.current = null
                onSpeechError?.("Google TTS playback failed")
                reject(new Error("Google TTS playback failed"))
              }

              // Start playback
              await audio.play()
              console.log(`🎤 Started Google TTS playback in ${languageCode} with ${gender} voice`)
            } catch (googleTTSError) {
              console.error(`❌ Google TTS failed for ${languageCode}, falling back to browser TTS:`, googleTTSError)

              // Fallback to browser TTS
              await fallbackToBrowserTTS(cleanedText, languageCode, gender, resolve, reject)
            }
          } else {
            // Use browser TTS for other languages
            await fallbackToBrowserTTS(cleanedText, languageCode, gender, resolve, reject)
          }
        } catch (error) {
          console.error("Speech synthesis error:", error)
          setIsSpeaking(false)
          onSpeechError?.("Speech synthesis failed")
          reject(error)
        }
      })
    },
    [currentLanguage.code, getRefinedVoiceForLanguage, onSpeechStart, onSpeechEnd, onSpeechError],
  )

  // Fallback to browser TTS
  const fallbackToBrowserTTS = useCallback(
    async (
      cleanedText: string,
      languageCode: string,
      gender: "male" | "female",
      resolve: () => void,
      reject: (error: Error) => void,
    ) => {
      if (!window.speechSynthesis) {
        const error = "Speech synthesis not supported"
        console.error(error)
        setIsSpeaking(false)
        onSpeechError?.(error)
        reject(new Error(error))
        return
      }

      // Stop any current speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(cleanedText)
      const locale = getLocaleForLanguage(languageCode)
      const speechParams = getNativeSpeechParameters(languageCode, gender)

      utterance.lang = locale

      // Select native voice based on gender
      const selectedVoice = getRefinedVoiceForLanguage(languageCode, gender)
      if (selectedVoice) {
        utterance.voice = selectedVoice
        console.log(`🎤 Using browser voice: ${selectedVoice.name} for ${languageCode} ${gender}`)
      }

      // Apply native speech parameters
      utterance.rate = speechParams.rate
      utterance.pitch = speechParams.pitch
      utterance.volume = speechParams.volume

      console.log(`🎯 Browser speech parameters for ${languageCode} ${gender}:`, {
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume,
      })

      // Handle events
      utterance.onstart = () => {
        console.log(`🎤 Started browser TTS in ${languageCode} ${gender}`)
      }

      utterance.onend = () => {
        console.log(`✅ Finished browser TTS in ${languageCode} ${gender}`)
        setIsSpeaking(false)
        currentUtteranceRef.current = null
        onSpeechEnd?.()
        resolve()
      }

      utterance.onerror = (event) => {
        const error = `Browser TTS error: ${event.error}`
        console.error(error)
        setIsSpeaking(false)
        currentUtteranceRef.current = null
        onSpeechError?.(event.error)
        reject(new Error(error))
      }

      // Store current utterance
      currentUtteranceRef.current = utterance

      // Start speaking with delay for stability
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance)
        } catch (error) {
          console.error("Error starting browser TTS:", error)
          setIsSpeaking(false)
          onSpeechError?.("Failed to start speech")
          reject(error as Error)
        }
      }, 100)
    },
    [getRefinedVoiceForLanguage, onSpeechEnd, onSpeechError],
  )

  // Stop speech function
  const stop = useCallback(() => {
    // Stop Google TTS audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }

    // Stop browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null
    }

    setIsSpeaking(false)
    speechQueueRef.current = []
    setQueueLength(0)
    isProcessingRef.current = false
    lastSpokenTextRef.current = ""
    console.log("🛑 Speech synthesis stopped")
  }, [])

  // Initialize voices
  useEffect(() => {
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          setIsReady(true)
          console.log(`✅ Loaded ${voices.length} voices for enhanced speech synthesis`)

          // Pre-cache voices for current language (both genders)
          const femaleVoice = getRefinedVoiceForLanguage(currentLanguage.code, "female")
          const maleVoice = getRefinedVoiceForLanguage(currentLanguage.code, "male")

          if (femaleVoice) {
            console.log(`✅ Pre-cached NATIVE ${currentLanguage.name} female: ${femaleVoice.name}`)
          }
          if (maleVoice) {
            console.log(`✅ Pre-cached NATIVE ${currentLanguage.name} male: ${maleVoice.name}`)
          }
        }
      }

      loadVoices()
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices)

      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
      }
    } else {
      // Even without browser TTS, we can use Google TTS
      setIsReady(true)
    }
  }, [currentLanguage.code, getRefinedVoiceForLanguage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    speak,
    stop,
    isSpeaking,
    isReady,
    queueLength,
  }
}
