"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Phone, X, Wifi, WifiOff, Brain, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getLocaleForLanguage,
  getNativeVoicePreferences,
  getNativeSpeechParameters,
} from "@/lib/i18n/translation-utils"
import { generateGoogleTTS, shouldUseGoogleTTS } from "@/lib/google-tts"

// Dr. Alexander's Google Cloud TTS credentials for voice calls
const VOICE_CALL_GOOGLE_TTS_CREDENTIALS = {
  type: "service_account",
  project_id: "strong-maker-471022-s6",
  private_key_id: "dc48898af9911d21c7959fd5b13bb28db7ea1354",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCuFvlHiJgmSpjv\n9stiMzxxidgqxcN2/ralj7zgkkjXXhOgikfeOhBpjvjBeLDgLxNynA7DjoQ8wHbf\ngdrRuCqnrg83NC/FXTLHDRXXLW+megwcNLu3Kl7gR7q8iABBw1FaZxFnjduejnti\nAxL3ZQnAFB9Uw2U9bQBh2TejD225TEJnyqiuecVD9pkAZE8aeN5ZgPnljLMjzkfk\njKSeZMU+2kHdcs4YCQ4ShNG2C7eL7mWsj1RpG9KKnOlkMlaZ8noM++pO4q7mCzc5\nDOUDv9gpCXKG1324KgZug1k3KN9jlyTdGs7r/MFcUHFRNWUOpCMdxkIdPLRMlWJT\nlF7uQabxAgMBAAECggEABbY6wRJV/aGicXMdOrBYKhh9929MKb4TM4zrA0pBahGL\n3s9SqtOoYLJAbqadVQmuX2sH3/ov1AdzjwNFcO6UNbK0DJlhfN4BMb836Xqz6Fgm\nSBGh3BFfkgfAdHmY2o+EPo1VqJpiq4ncuftEVsohnwP6AC+2BWUrZ0p3dRnnPXZZ\nad02aThfaG73awScY5T0rotCIlq5M2z748EoBKHPUKELFunq5EiPiQfSIynO/Gpm\nayNtJ8OH8eQXNEnr5ixa/lo3L3g8w2cA+DnMTrFX1UGsbgoGgbY9/8c4bSEAcjUA\na6U8NxTb9jqjDcnIeXmG6XW3Qhhu385EwqvGQSg4HQKBgQm2AQfF/RKkjbKworS\nXZfaBVgsMqR7pkqnOX54Fr/Y0mkdY6qjh4rG+OBo2GHLn+VRLSbWVSmpy962cZWo\nXHdi9n4rMSXApxLoYdb9pNeYrNO6uxxC+DM7R2tTI8J6LtyuTEsw9s/AOYkP/Skf\nUswHgqexqpZ3pAnZS3Ova7njRQKBgQDBD6gGwOa7krhpfgwJnhd7ver+Bar8VN1E\n2QFnCpETx2NGtZtOKwD2k+Zn+Y8dv/+TSaSj6kERgjqDBvSj/XU8kNN2Wdc22nwW\nnnLTo2fusaKpZP3OWdgNUMv7cC7RKjK5ZecO0JZGRF7f+6N4zs2707cbxAf0qR+S\nzTDbNii5vQKBgQCWe0bkhhcH7ZyuPHeGfuCYjVdXKIQ03shXjpE084+IZlGDiQ8Z\nnygGYQLZFgVaWheA/XAN1GJef7nlMNIgeHaTGqBQw68akU8wEWe23Rh2PGOhnIvl\n1CqBgCMkhXEneRj+vlldx+bSJi+FLsD53F2In9F1bgC8aUDKV/dH6W+6CQKBgQCy\nA4quN35JJH9QHj5hO9lxauvcMEO6CVJBYkrtxQuCjk4W6+t5ByQLONKxuqXhC6FQ\nIQ5jaeN3jnn/SRGYiGNqZivlq+9Kj+jtPkqopLp3mGlhAlMYyzTxCjgb7xPsH5nH\n45NK0MBPqElHBBN2mFGRSCVFv9qKGMuZJARRjL2+jQKBgQDVV50qRixSs2PkfbQa\n+NsCz16EHBFTz8mGkPtNZtWB2eZUK3toxmDw+iZormjPN8IxdgVjUmH4nA+PVMg9\nzcg+vXDBQlkD+lr3LDxi6vWfThbC1aY8W34qCjPBFYYPGH8W8sWUMSi388I5P3cI\ntI/Wlzv7csphuz620VfkkJlHjw==\n-----END PRIVATE KEY-----\n",
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
const VOICE_CALL_CONFIGS = {
  uk: {
    female: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Standard-A",
      ssmlGender: "MALE",
    },
  },
}

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
    AudioContext?: any
  }
}

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  webhookUrl: string
  openAiApiKey: string
  onError?: (error: Error) => void
  userEmail?: string
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  webhookUrl,
  openAiApiKey,
  onError,
  userEmail,
}: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  // State management
  const [isMuted, setIsMuted] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState<string>("")
  const [interimTranscript, setInterimTranscript] = useState<string>("")
  const [aiResponse, setAiResponse] = useState<string>("")
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [useTextOnlyMode, setUseTextOnlyMode] = useState<boolean>(false)
  const [networkError, setNetworkError] = useState<string>("")
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting">(
    "disconnected",
  )
  const [retryCount, setRetryCount] = useState(0)
  const [bypassNetworkCheck, setBypassNetworkCheck] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female")

  // CRITICAL: Ref to store the CURRENT voice gender synchronously
  const currentVoiceGenderRef = useRef<"female" | "male">("female")

  // Refs
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef<boolean>(false)
  const lastProcessedTranscriptRef = useRef<string>("")
  const lastAiResponseRef = useRef<string>("")
  const isVoicingRef = useRef<boolean>(false)
  const cleanupSpeechSynthesisRef = useRef<(() => void) | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())
  const voiceValidationRef = useRef<Map<string, boolean>>(new Map())
  const voiceLoadedRef = useRef<boolean>(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceResponseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isRestartingRecognitionRef = useRef<boolean>(false)
  const maxRetries = 3

  const [audioInitialized, setAudioInitialized] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Get current language locale for speech recognition and synthesis
  const currentLocale = getLocaleForLanguage(currentLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  console.log(
    `🌐 Voice call using language: ${currentLanguage.name} (${currentLanguage.code}) - Locale: ${currentLocale} - Gender: ${currentVoiceGenderRef.current}`,
  )

  // Enhanced voice selection with native accent support
  const getRefinedVoiceForLanguage = useCallback(
    (langCode: string, preferredGender: "female" | "male"): SpeechSynthesisVoice | null => {
      if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported")
        return null
      }

      const cacheKey = `${langCode}-${preferredGender}`

      if (voiceCacheRef.current.has(cacheKey)) {
        const cachedVoice = voiceCacheRef.current.get(cacheKey)!
        if (voiceValidationRef.current.get(cacheKey) === true) {
          console.log(`✓ Using cached native voice: ${cachedVoice.name} for ${langCode} ${preferredGender}`)
          return cachedVoice
        }
      }

      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        console.warn("No voices available yet, will retry when voices load")
        return null
      }

      console.log(`🎯 Finding native voice for ${langCode} ${preferredGender} from ${voices.length} voices`)

      const nativeVoices = nativeVoicePreferences[langCode]?.[preferredGender] || []

      for (const voiceName of nativeVoices) {
        const exactMatch = voices.find((v) => v.name === voiceName)
        if (exactMatch) {
          console.log(`✅ NATIVE exact match: ${exactMatch.name} for ${langCode} ${preferredGender}`)
          voiceCacheRef.current.set(cacheKey, exactMatch)
          voiceValidationRef.current.set(cacheKey, true)
          return exactMatch
        }
      }

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
          voiceValidationRef.current.set(cacheKey, true)
          return partialMatch
        }
      }

      const getLanguageVoices = (lang: string) => {
        const langLower = lang.toLowerCase()
        return voices.filter((v) => {
          const voiceLang = v.lang.toLowerCase()
          const voiceName = v.name.toLowerCase()

          if (voiceLang.startsWith(langLower)) return true
          if (voiceLang.includes(`${langLower}-`)) return true

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
        const scoredVoices = langVoices.map((voice) => {
          let score = 10

          const lowerName = voice.name.toLowerCase()
          const lowerLang = voice.lang.toLowerCase()

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

          if (genderHints.some((hint) => lowerName.includes(hint))) score += 40
          if (lowerName.includes("neural")) score += 30
          if (lowerName.includes("wavenet")) score += 25
          if (lowerName.includes("premium")) score += 22
          if (lowerName.includes("enhanced")) score += 20
          if (lowerName.includes("professional")) score += 18
          if (lowerName.includes("therapeutic")) score += 18
          if (lowerName.includes("natural")) score += 15
          if (lowerName.includes("google")) score += 20
          if (lowerName.includes("microsoft")) score += 18
          if (lowerName.includes("yandex") && langCode === "ru") score += 25

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
          if (nativeVoiceNames.some((nv) => lowerName.includes(nv))) score += 45
          if (lowerLang.startsWith(langCode.toLowerCase())) score += 20
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
        voiceValidationRef.current.set(cacheKey, true)
        return bestVoice
      }

      console.warn(`⚠️ No ${langCode} voices found, using cross-language native fallbacks`)

      if (langCode === "uk") {
        const russianVoice = getRefinedVoiceForLanguage("ru", preferredGender)
        if (russianVoice) {
          console.log(`✅ Using NATIVE Russian voice for Ukrainian ${preferredGender}: ${russianVoice.name}`)
          voiceCacheRef.current.set(cacheKey, russianVoice)
          voiceValidationRef.current.set(cacheKey, true)
          return russianVoice
        }
      }

      if (langCode !== "en") {
        const englishVoice = getRefinedVoiceForLanguage("en", preferredGender)
        if (englishVoice) {
          console.log(`✅ Using NATIVE English voice for ${langCode} ${preferredGender}: ${englishVoice.name}`)
          voiceCacheRef.current.set(cacheKey, englishVoice)
          voiceValidationRef.current.set(cacheKey, true)
          return englishVoice
        }
      }

      if (voices.length > 0) {
        const lastResortVoice = voices[0]
        console.log(`⚠️ Last resort voice for ${langCode} ${preferredGender}: ${lastResortVoice.name}`)
        voiceCacheRef.current.set(cacheKey, lastResortVoice)
        voiceValidationRef.current.set(cacheKey, true)
        return lastResortVoice
      }

      console.error(`❌ No voices available at all for ${langCode} ${preferredGender}`)
      return null
    },
    [nativeVoicePreferences],
  )

  const initializeMobileAudio = useCallback(async () => {
    if (audioInitialized) return

    try {
      // Create and resume AudioContext for mobile
      if (typeof window !== "undefined" && "AudioContext" in window) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass()
        }

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume()
          console.log("✅ [MOBILE] AudioContext resumed")
        }
      }

      // Play silent audio to unlock mobile audio
      const silentAudio = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/jQwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
      )
      silentAudio.playsInline = true
      silentAudio.volume = 0.01

      try {
        await silentAudio.play()
        silentAudio.pause()
        silentAudio.currentTime = 0
        console.log("✅ [MOBILE] Silent audio played - mobile audio unlocked")
      } catch (e) {
        console.log("⚠️ [MOBILE] Silent audio play failed (may not be needed):", e)
      }

      setAudioInitialized(true)
      console.log("✅ [MOBILE] Audio system initialized")
    } catch (error) {
      console.error("❌ [MOBILE] Audio initialization error:", error)
    }
  }, [audioInitialized])

  // CRITICAL: Immediate voice synthesis - interrupts current speech for new N8N response
  const immediateVoiceSynthesis = useCallback(
    async (text: string, explicitGender: "female" | "male") => {
      const genderToUse = explicitGender

      console.log(
        `🎤 [IMMEDIATE VOICE] New N8N response - interrupting any current speech to announce immediately`,
        text.substring(0, 50) + "...",
      )

      // INTERRUPT any current speech immediately for new N8N response
      if (isVoicingRef.current) {
        console.log("🎤 [IMMEDIATE VOICE] Stopping current speech to announce new N8N response")
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
          currentAudioRef.current = null
        }
        if (currentUtteranceRef.current && window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel()
          currentUtteranceRef.current = null
        }
      }

      // Clear any pending voice timers
      if (voiceResponseTimerRef.current) {
        clearTimeout(voiceResponseTimerRef.current)
        voiceResponseTimerRef.current = null
      }

      isVoicingRef.current = false
      setIsAiSpeaking(false)

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Mark as voicing and update state
      isVoicingRef.current = true
      setIsAiSpeaking(true)
      lastAiResponseRef.current = text

      console.log(
        `🎤 [IMMEDIATE VOICE] Starting synthesis in ${currentLanguage.name} with ${genderToUse} voice (IMMEDIATE delivery)`,
      )

      // Calculate timeout based on text length (approximately 150 words per minute)
      const wordCount = text.trim().split(/\s+/).length
      const estimatedDuration = (wordCount / 150) * 60 * 1000 // Convert to milliseconds
      const safetyTimeoutDuration = Math.max(estimatedDuration * 1.5, 35000) // At least 35 seconds

      console.log(
        `🎤 [IMMEDIATE VOICE] Text has ${wordCount} words, estimated duration: ${Math.round(estimatedDuration / 1000)}s, timeout: ${Math.round(safetyTimeoutDuration / 1000)}s`,
      )

      const safetyTimeout = setTimeout(() => {
        console.log("⏰ [IMMEDIATE VOICE] Safety timeout triggered")
        isVoicingRef.current = false
        setIsAiSpeaking(false)
      }, safetyTimeoutDuration)

      const cleanup = () => {
        try {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause()
            currentAudioRef.current.currentTime = 0
            currentAudioRef.current = null
          }

          if (currentUtteranceRef.current && window.speechSynthesis) {
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.cancel()
            }
            currentUtteranceRef.current = null
          }

          clearTimeout(safetyTimeout)
          isVoicingRef.current = false
          setIsAiSpeaking(false)
          console.log("✅ [IMMEDIATE VOICE] Cleanup completed")
        } catch (e) {
          console.log("⚠️ [IMMEDIATE VOICE] Error in cleanup:", e)
          isVoicingRef.current = false
          setIsAiSpeaking(false)
        }
      }

      cleanupSpeechSynthesisRef.current = cleanup

      try {
        const cleanText = text.trim()
        if (!cleanText) {
          cleanup()
          return () => {}
        }

        // Split long text into chunks for better handling
        const chunks: string[] = []
        if (cleanText.length > 1000) {
          const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText]
          let currentChunk = ""

          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > 1000 && currentChunk.length > 0) {
              chunks.push(currentChunk.trim())
              currentChunk = sentence
            } else {
              currentChunk += " " + sentence
            }
          }

          if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim())
          }

          console.log(`🎤 [IMMEDIATE VOICE] Split long text into ${chunks.length} chunks`)
        } else {
          chunks.push(cleanText)
        }

        // Process chunks sequentially
        const processChunks = async (index: number) => {
          if (index >= chunks.length) {
            cleanup()
            return
          }

          const chunk = chunks[index]
          console.log(`🎤 [IMMEDIATE VOICE] Processing chunk ${index + 1}/${chunks.length}`)

          if (shouldUseGoogleTTS(currentLanguage.code)) {
            console.log(`🎤 [IMMEDIATE VOICE] Using Google TTS for chunk ${index + 1}`)

            try {
              const audioDataUrl = await generateGoogleTTS(
                chunk,
                currentLanguage.code,
                genderToUse,
                VOICE_CALL_GOOGLE_TTS_CREDENTIALS,
                VOICE_CALL_CONFIGS,
              )

              const audio = new Audio(audioDataUrl)
              currentAudioRef.current = audio

              audio.playsInline = true
              audio.crossOrigin = "anonymous"
              audio.setAttribute("playsinline", "true")
              audio.setAttribute("webkit-playsinline", "true")
              audio.preload = "auto"

              audio.onended = () => {
                console.log(`✅ [IMMEDIATE VOICE] Google TTS chunk ${index + 1}/${chunks.length} completed`)
                currentAudioRef.current = null

                // Process next chunk
                if (index + 1 < chunks.length) {
                  setTimeout(() => processChunks(index + 1), 300)
                } else {
                  cleanup()
                }
              }

              audio.onerror = (error) => {
                console.log(`❌ [AUDIO] Playback error:`, error)
                console.log(
                  `⚠️ [IMMEDIATE VOICE] Google TTS audio error on chunk ${index + 1}, falling back to browser TTS`,
                )
                currentAudioRef.current = null
                isVoicingRef.current = false
                setIsAiSpeaking(false)
                // Try browser TTS as fallback for this chunk
                executeBrowserTTSChunk(chunk, genderToUse, index, chunks.length, processChunks, cleanup)
              }

              audio.load()

              // Wait for audio to be ready
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  console.log("⚠️ [MOBILE] Audio load timeout, trying to play anyway")
                  resolve(true)
                }, 3000)

                audio.oncanplaythrough = () => {
                  clearTimeout(timeout)
                  resolve(true)
                }

                // Don't reject on error, just resolve and try to play
                audio.onerror = () => {
                  clearTimeout(timeout)
                  resolve(true)
                }
              })

              await audio.play()
              console.log(`🎤 [IMMEDIATE VOICE] Google TTS playback started for chunk ${index + 1}`)
            } catch (googleTTSError) {
              console.log(
                `❌ [IMMEDIATE VOICE] Google TTS failed for chunk ${index + 1}, using browser TTS:`,
                googleTTSError,
              )
              currentAudioRef.current = null
              isVoicingRef.current = false
              setIsAiSpeaking(false)
              executeBrowserTTSChunk(chunk, genderToUse, index, chunks.length, processChunks, cleanup)
            }
          } else {
            executeBrowserTTSChunk(chunk, genderToUse, index, chunks.length, processChunks, cleanup)
          }
        }

        // Start processing chunks immediately
        await processChunks(0)

        return cleanup
      } catch (error) {
        console.log("❌ [IMMEDIATE VOICE] Speech synthesis error:", error)
        cleanup()
        return () => {}
      }
    },
    [currentLanguage],
  )

  // Execute browser TTS for a single chunk
  const executeBrowserTTSChunk = useCallback(
    (
      chunk: string,
      explicitGender: "female" | "male",
      index: number,
      totalChunks: number,
      processChunks: (index: number) => void,
      cleanup: () => void,
    ) => {
      console.log(`🎤 [IMMEDIATE VOICE] Using browser TTS for chunk ${index + 1}/${totalChunks}`)

      if (!window.speechSynthesis) {
        console.log("❌ [IMMEDIATE VOICE] Speech synthesis not supported")
        isVoicingRef.current = false
        setIsAiSpeaking(false)
        // Try next chunk or cleanup
        if (index + 1 < totalChunks) {
          setTimeout(() => processChunks(index + 1), 300)
        } else {
          cleanup()
        }
        return
      }

      setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance()
          utterance.text = chunk
          utterance.lang = currentLocale

          const selectedVoice = getRefinedVoiceForLanguage(currentLanguage.code, explicitGender)
          if (selectedVoice) {
            utterance.voice = selectedVoice
            console.log(`✅ [IMMEDIATE VOICE] Using browser voice: ${selectedVoice.name} for chunk ${index + 1}`)
          }

          const speechParameters = getNativeSpeechParameters(currentLanguage.code, explicitGender)
          utterance.rate = speechParameters.rate
          utterance.pitch = speechParameters.pitch
          utterance.volume = speechParameters.volume

          utterance.onstart = () => {
            console.log(`🎤 [IMMEDIATE VOICE] Browser TTS started for chunk ${index + 1}/${totalChunks}`)
          }

          utterance.onend = () => {
            console.log(`✅ [IMMEDIATE VOICE] Browser TTS completed chunk ${index + 1}/${totalChunks}`)
            currentUtteranceRef.current = null

            // Process next chunk
            if (index + 1 < totalChunks) {
              setTimeout(() => processChunks(index + 1), 300)
            } else {
              cleanup()
            }
          }

          utterance.onerror = (err) => {
            const errorType = err.error || "unknown error"
            console.log(`⚠️ [IMMEDIATE VOICE] Browser TTS error on chunk ${index + 1}: ${errorType}`)
            currentUtteranceRef.current = null
            isVoicingRef.current = false
            setIsAiSpeaking(false)

            // Continue with next chunk even on error
            if (index + 1 < totalChunks) {
              setTimeout(() => processChunks(index + 1), 300)
            } else {
              cleanup()
            }
          }

          currentUtteranceRef.current = utterance

          setTimeout(() => {
            try {
              window.speechSynthesis.speak(utterance)
              console.log(`🎤 [IMMEDIATE VOICE] Browser TTS speech started for chunk ${index + 1}`)
            } catch (speakError) {
              console.log(`❌ [IMMEDIATE VOICE] Error starting browser TTS for chunk ${index + 1}:`, speakError)
              isVoicingRef.current = false
              setIsAiSpeaking(false)
              // Continue with next chunk
              if (index + 1 < totalChunks) {
                setTimeout(() => processChunks(index + 1), 300)
              } else {
                cleanup()
              }
            }
          }, 300)
        } catch (innerError) {
          console.log(`❌ [IMMEDIATE VOICE] Inner browser TTS error for chunk ${index + 1}:`, innerError)
          isVoicingRef.current = false
          setIsAiSpeaking(false)
          // Continue with next chunk
          if (index + 1 < totalChunks) {
            setTimeout(() => processChunks(index + 1), 300)
          } else {
            cleanup()
          }
        }
      }, 500)
    },
    [getRefinedVoiceForLanguage, currentLanguage, currentLocale],
  )

  // Start speech recognition
  const startSpeechRecognition = useCallback(() => {
    setNetworkError("")

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition()

      recognitionInstance.continuous = true
      recognitionInstance.interimResults = true
      recognitionInstance.maxAlternatives = 1
      recognitionInstance.lang = currentLocale

      console.log(`🎤 Starting speech recognition in ${currentLanguage.name} (${currentLocale})`)

      let finalTranscriptBuffer = ""

      recognitionInstance.onstart = () => {
        setIsListening(true)
        isRestartingRecognitionRef.current = false
        setConnectionStatus("connected")
        setNetworkError("")
        setRetryCount(0)
        console.log(`✅ Speech recognition started in ${currentLanguage.name}`)
      }

      recognitionInstance.onresult = async (event) => {
        let currentInterimTranscript = ""
        let hasNewFinalResult = false

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript

          if (result.isFinal) {
            finalTranscriptBuffer += transcript + " "
            hasNewFinalResult = true
          } else {
            currentInterimTranscript += transcript
          }
        }

        setInterimTranscript(currentInterimTranscript)

        if (hasNewFinalResult && finalTranscriptBuffer.trim().length > 1) {
          const textToProcess = finalTranscriptBuffer.trim()
          finalTranscriptBuffer = ""
          setInterimTranscript("")

          if (textToProcess === lastProcessedTranscriptRef.current) {
            console.log("Duplicate transcript detected, skipping:", textToProcess)
            return
          }

          setTranscript((prev) => (prev ? `${prev} ${textToProcess}` : textToProcess))

          if (!isProcessingRef.current) {
            lastProcessedTranscriptRef.current = textToProcess
            processTranscription(textToProcess)
          } else {
            console.log("Already processing, queueing transcript")
          }
        }
      }

      recognitionInstance.onerror = async (event) => {
        console.log("Speech recognition error", event.error)

        switch (event.error) {
          case "language-not-supported":
            console.log(`Language ${recognitionInstance.lang} not supported, falling back to English`)
            recognitionInstance.lang = "en-US"
            setTimeout(() => {
              try {
                recognitionInstance.start()
                setIsListening(true)
              } catch (e) {
                console.log("Failed to restart with English:", e)
                retryRecognition()
              }
            }, 1000)
            break

          case "network":
            setNetworkError(t("Network error occurred. Attempting to reconnect..."))
            setConnectionStatus("disconnected")
            await retryRecognition()
            break

          case "not-allowed":
            setNetworkError(t("Microphone access denied. Please allow microphone access and try again."))
            setConnectionStatus("disconnected")
            setIsListening(false)
            break

          case "no-speech":
            console.log("No speech detected, continuing to listen...")
            if (isCallActive && !isMicMuted && retryCount < maxRetries) {
              setTimeout(() => {
                try {
                  recognitionInstance.start()
                  setIsListening(true)
                } catch (e) {
                  console.log("Failed to restart recognition:", e)
                  retryRecognition()
                }
              }, 1000)
            }
            break

          default:
            if (isCallActive && !isMicMuted) {
              await retryRecognition()
            }
            break
        }
      }

      recognitionInstance.onend = () => {
        console.log("🎤 [RECOGNITION END] Speech recognition ended - will restart immediately")

        if (isRestartingRecognitionRef.current) {
          console.log("🎤 [RECOGNITION END] Already restarting, skipping duplicate restart")
          return
        }

        if (isCallActive && !isMicMuted) {
          console.log("🎤 [CONTINUOUS] Restarting speech recognition - maintaining listening state")
          isRestartingRecognitionRef.current = true
          setIsListening(true)

          setTimeout(() => {
            try {
              recognitionInstance.start()
              console.log("🎤 [CONTINUOUS] Recognition restarted successfully")
              setIsListening(true)
            } catch (e) {
              console.log("Failed to restart recognition:", e)
              isRestartingRecognitionRef.current = false
              setIsListening(true)
              retryRecognition()
            }
          }, 50)
        } else {
          console.log("🎤 [STOP] Microphone muted or call ended - stopping listening")
          isRestartingRecognitionRef.current = false
          setIsListening(false)
          if (networkError) {
            setConnectionStatus("disconnected")
          }
        }
      }

      try {
        recognitionInstance.start()

        recognitionRef.current = {
          stop: () => {
            try {
              isRestartingRecognitionRef.current = false
              recognitionInstance.stop()
            } catch (e) {
              console.log("Error stopping recognition:", e)
            }
          },
          start: () => {
            if (recognitionInstance.state !== "running") {
              try {
                recognitionInstance.start()
              } catch (e) {
                console.log("Error starting recognition:", e)
                retryRecognition()
              }
            }
          },
        }
      } catch (error) {
        console.log("Error starting speech recognition:", error)
        setNetworkError(t("Failed to start speech recognition. Trying alternative method..."))
        fallbackToMediaRecorder()
      }
    } else {
      fallbackToMediaRecorder()
    }
  }, [currentLocale, currentLanguage, isCallActive, isMicMuted, t, retryCount, networkError])

  // CRITICAL: Process transcription with immediate voice response
  const processTranscription = useCallback(
    async (text: string) => {
      if (isProcessingRef.current) {
        console.log("Already processing, skipping duplicate processing")
        return
      }

      isProcessingRef.current = true

      const currentGender = currentVoiceGenderRef.current
      console.log(`📤 [PROCESSING] Processing transcript with ${currentGender} voice (IMMEDIATE delivery)`)

      let aiResponseText = ""

      try {
        console.log(`📤 Sending to n8n workflow in ${currentLanguage.name} (${currentLanguage.code}):`, text)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const params = new URLSearchParams({
          text: text,
          language: currentLanguage.code,
          languageName: currentLanguage.name,
          locale: currentLocale,
          user: userEmail || (user?.email ? user.email : "guest@example.com"),
          requestType: "voice_call",
          voiceGender: currentGender,
        })

        const webhookUrlWithParams = `https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59?${params.toString()}`

        const webhookResponse = await fetch(webhookUrlWithParams, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Accept-Language": currentLanguage.code,
            "Content-Language": currentLanguage.code,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => "Unknown error")
          throw new Error(`Webhook error: ${webhookResponse.status} - ${errorText}`)
        }

        const responseData = await webhookResponse.json().catch((error) => {
          console.log("Error parsing webhook response:", error)
          return { response: t("I received your message but couldn't process the response properly.") }
        })

        console.log(`📥 Raw n8n webhook response in ${currentLanguage.name}:`, responseData)

        aiResponseText = extractPlainText(responseData)

        if (!aiResponseText || aiResponseText.trim().length === 0) {
          aiResponseText = t("I received your message but couldn't generate a proper response.")
        }

        aiResponseText = cleanResponseText(aiResponseText)

        console.log(
          `📝 Final AI response in ${currentLanguage.name} with ${currentGender} voice (WILL BE ANNOUNCED IMMEDIATELY):`,
          aiResponseText.substring(0, 100) + "...",
        )

        setAiResponse(aiResponseText)

        // CRITICAL: Immediately announce the new N8N response, interrupting any current speech
        console.log(`🎤 [N8N RESPONSE] Announcing new response IMMEDIATELY (interrupting any current speech)`)
        voiceResponseTimerRef.current = setTimeout(() => {
          immediateVoiceSynthesis(aiResponseText, currentGender)
        }, 100)
      } catch (error) {
        console.log("Error processing transcript:", error)

        let errorMessage = ""
        if (error.name === "AbortError") {
          errorMessage = t("I'm having trouble connecting. Let me try again.")
          setNetworkError(t("Connection timeout"))
        } else {
          errorMessage = t("I'm sorry, I couldn't process what you said. Could you try again?")
          setNetworkError(t("Processing error occurred"))

          if (onError) {
            onError(error as Error)
          }
        }

        setAiResponse(errorMessage)

        // Announce error message immediately
        voiceResponseTimerRef.current = setTimeout(() => {
          immediateVoiceSynthesis(errorMessage, currentGender)
        }, 100)
      } finally {
        isProcessingRef.current = false
      }
    },
    [currentLanguage, currentLocale, userEmail, user?.email, t, onError, immediateVoiceSynthesis],
  )

  // Retry speech recognition with exponential backoff
  const retryRecognition = async () => {
    if (retryCount >= maxRetries) {
      setNetworkError(t("Unable to connect to speech recognition service. Please check your internet connection."))
      setConnectionStatus("disconnected")
      return
    }

    setConnectionStatus("reconnecting")
    setRetryCount((prev) => prev + 1)

    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)

    setTimeout(() => {
      if (isCallActive && !isMuted) {
        startSpeechRecognition()
      }
    }, delay)
  }

  // Fallback to MediaRecorder
  const fallbackToMediaRecorder = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.log("Media devices not supported")
      setAiResponse(t("Voice input is not supported in your browser. Please try using Chrome."))
      setNetworkError(t("Voice input not supported in this browser"))
      return
    }

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
        const audioChunks: BlobPart[] = []

        mediaRecorder.addEventListener("dataavailable", (event) => {
          audioChunks.push(event.data)
        })

        mediaRecorder.addEventListener("stop", async () => {
          if (audioChunks.length === 0) return

          const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
          await processAudioWithOpenAI(audioBlob)
        })

        const startRecording = () => {
          if (isMicMuted) return
          audioChunks.length = 0
          try {
            mediaRecorder.start()
            setIsListening(true)
            setConnectionStatus("connected")
          } catch (e) {
            console.log("Error starting media recorder:", e)
            setNetworkError(t("Failed to start audio recording"))
          }

          setTimeout(() => {
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop()
              setIsListening(false)
            }
          }, 3000)
        }

        const recordingInterval = setInterval(() => {
          if (isCallActive && !isMuted && !isProcessingRef.current) {
            startRecording()
          }
        }, 4000)

        startRecording()

        recognitionRef.current = {
          stop: () => {
            clearInterval(recordingInterval)
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop()
            }
            stream.getTracks().forEach((track) => track.stop())
            setIsListening(false)
            setConnectionStatus("disconnected")
          },
          start: startRecording,
        }
      })
      .catch((error) => {
        console.log("Error accessing microphone:", error)
        setAiResponse(t("Could not access your microphone. Please check your permissions."))
        setNetworkError(t("Microphone access denied"))
        setConnectionStatus("disconnected")
      })
  }

  // Process audio with OpenAI Whisper API
  const processAudioWithOpenAI = async (audioBlob: Blob) => {
    if (isProcessingRef.current) return

    isProcessingRef.current = true

    try {
      const formData = new FormData()
      formData.append("file", audioBlob, "audio.webm")
      formData.append("model", "whisper-1")
      formData.append("language", currentLanguage.code)
      formData.append("response_format", "text")

      console.log(`🎤 Transcribing audio in ${currentLanguage.name} (${currentLanguage.code})`)

      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(10000),
      })

      if (!transcriptionResponse.ok) {
        throw new Error(`Transcription error: ${transcriptionResponse.status}`)
      }

      const transcription = await transcriptionResponse.text()

      if (transcription.trim()) {
        setTranscript((prev) => (prev ? `${prev} ${transcription.trim()}` : transcription.trim()))
        await processTranscription(transcription.trim())
      }
    } catch (error) {
      console.log("Error processing audio:", error)
      if (error.name === "TimeoutError") {
        setNetworkError(t("Audio processing timed out. Please try again."))
      } else {
        setAiResponse(t("I'm sorry, I couldn't process your audio. Please try again."))
      }
    } finally {
      isProcessingRef.current = false
    }
  }

  // Check network connectivity
  const checkNetworkConnectivity = async (): Promise<boolean> => {
    if (bypassNetworkCheck) {
      return true
    }

    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      if (!navigator.onLine) {
        console.log("Navigator indicates offline")
        return false
      }
    }

    const connectivityChecks = [
      () =>
        fetch("/favicon.ico", {
          method: "HEAD",
          cache: "no-cache",
          signal: AbortSignal.timeout(3000),
        }),
      () =>
        fetch(window.location.href, {
          method: "HEAD",
          cache: "no-cache",
          signal: AbortSignal.timeout(3000),
        }),
    ]

    for (const check of connectivityChecks) {
      try {
        const response = await check()
        if (response.ok) {
          console.log("Network connectivity confirmed")
          return true
        }
      } catch (error) {
        console.log("Connectivity check failed:", error)
        continue
      }
    }

    console.log("All connectivity checks failed")
    return false
  }

  // Start call with IMMEDIATE gender setting in ref
  const startCall = async (explicitGender: "female" | "male") => {
    setIsConnecting(true)
    setNetworkError("")
    setRetryCount(0)

    currentVoiceGenderRef.current = explicitGender
    console.log(`🎤 [START CALL] Set currentVoiceGenderRef to: ${explicitGender}`)

    setVoiceGender(explicitGender)

    try {
      await initializeMobileAudio()

      if (!bypassNetworkCheck) {
        console.log("Checking network connectivity...")
        const isConnected = await checkNetworkConnectivity()
        if (!isConnected) {
          setNetworkError(t("Network check failed. You can try to continue anyway."))
          setIsConnecting(false)
          return
        }
      }

      setIsCallActive(true)
      setConnectionStatus("connected")
      setNetworkError("")

      lastProcessedTranscriptRef.current = ""
      lastAiResponseRef.current = ""
      isVoicingRef.current = false

      console.log(`🎤 Starting call with ${explicitGender} voice in ${currentLanguage.name}`)

      startSpeechRecognition()
    } catch (error) {
      console.log("Failed to start call:", error)
      setAiResponse(error instanceof Error ? error.message : t("Failed to start the call. Please try again."))
      setConnectionStatus("disconnected")
    } finally {
      setIsConnecting(false)
    }
  }

  // Force start call bypassing network check
  const forceStartCall = () => {
    setBypassNetworkCheck(true)
    setNetworkError("")
    startCall(currentVoiceGenderRef.current)
  }

  // End call
  const endCall = () => {
    setIsCallActive(false)
    setIsListening(false)
    setConnectionStatus("disconnected")
    setNetworkError("")
    setRetryCount(0)
    setBypassNetworkCheck(false)

    // Clear all timers
    if (voiceResponseTimerRef.current) {
      clearTimeout(voiceResponseTimerRef.current)
      voiceResponseTimerRef.current = null
    }

    // Stop all audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }

    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.log("Error stopping recognition:", error)
      }
    }

    // Clear all state
    setIsAiSpeaking(false)
    setTranscript("")
    setInterimTranscript("")
    setAiResponse("")
    lastProcessedTranscriptRef.current = ""
    lastAiResponseRef.current = ""
    isVoicingRef.current = false

    if (cleanupSpeechSynthesisRef.current) {
      cleanupSpeechSynthesisRef.current()
      cleanupSpeechSynthesisRef.current = null
    }
  }

  // Toggle mute
  const toggleMute = () => {
    const newMutedState = !isMicMuted
    setIsMicMuted(newMutedState)

    if (recognitionRef.current) {
      if (newMutedState) {
        console.log("🎤 [MUTE] Muting microphone - stopping recognition immediately")
        isRestartingRecognitionRef.current = false
        if (recognitionRef.current && recognitionRef.current.stop) {
          recognitionRef.current.stop()
        }
        setIsListening(false)
        console.log("🎤 [MUTE] Microphone muted")
      } else {
        console.log("🎤 [UNMUTE] Unmuting microphone - restarting recognition immediately")
        setNetworkError("")
        setRetryCount(0)
        setIsListening(true)
        startSpeechRecognition()
        console.log("🎤 [UNMUTE] Microphone unmuted - resuming recognition")
      }
    }
  }

  // Initialize voice system
  useEffect(() => {
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          voiceLoadedRef.current = true
          console.log(`✅ Loaded ${voices.length} voices for ${currentLanguage.name}`)

          const femaleVoice = getRefinedVoiceForLanguage(currentLanguage.code, "female")
          const maleVoice = getRefinedVoiceForLanguage(currentLanguage.code, "male")

          if (femaleVoice) {
            console.log(`✅ Pre-validated NATIVE ${currentLanguage.name} female: ${femaleVoice.name}`)
          }
          if (maleVoice) {
            console.log(`✅ Pre-validated NATIVE ${currentLanguage.name} male: ${maleVoice.name}`)
          }
        }
      }

      loadVoices()
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices)

      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
      }
    }
  }, [currentLanguage, getRefinedVoiceForLanguage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceResponseTimerRef.current) {
        clearTimeout(voiceResponseTimerRef.current)
      }
    }
  }, [])

  if (!isOpen) return null

  const userEmailDisplay = userEmail || (user?.email ? user.email : "guest@example.com")

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">
              {voiceGender === "female" ? t("Female Voice Call") : t("Male Voice Call")}
            </h3>
            <div className="text-xs text-lavender-200">
              {t("User")}: {userEmailDisplay}
            </div>
            <div className="text-xs text-lavender-200 mt-1">
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
            {shouldUseGoogleTTS(currentLanguage.code) && (
              <div className="text-xs text-green-200 mt-1 flex items-center">
                <span className="mr-1">🎤</span>
                {t("Google TTS")} - {voiceGender === "female" ? t("Female") : t("Male")} {t("Voice")}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {connectionStatus === "connected" && <Wifi className="h-4 w-4 text-green-300" title={t("Connected")} />}
            {connectionStatus === "disconnected" && (
              <WifiOff className="h-4 w-4 text-red-300" title={t("Disconnected")} />
            )}
            {connectionStatus === "reconnecting" && (
              <div className="flex items-center text-yellow-300">
                <svg
                  className="w-4 h-4 animate-spin mr-1"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V2.5a1.5 1.5 0 013 0V4a8 8 0 01-8 8H4z"
                  ></path>
                </svg>
                {t("Reconnecting...")}
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {!isCallActive ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center mb-6">
                <Phone className="h-12 w-12 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">{t("Ready to start your voice session?")}</h3>
              <p className="text-gray-600 text-center mb-6">
                {t("Speak directly with our AI psychologist for immediate support.")}
              </p>

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center">
                <p className="text-sm font-medium text-blue-700 mb-1">{t("Voice communication language")}:</p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{currentLanguage.flag}</span>
                  {currentLanguage.name}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {shouldUseGoogleTTS(currentLanguage.code)
                    ? t("AI will use Google TTS for authentic native accent")
                    : t("AI will understand and respond in this language with native accent")}
                </p>
              </div>

              <div className="flex flex-col space-y-3 w-full max-w-xs">
                <Button
                  className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 flex items-center justify-center"
                  onClick={() => {
                    console.log("🎤 [BUTTON CLICK] Female voice button clicked")
                    startCall("female")
                  }}
                  disabled={isConnecting}
                >
                  {isConnecting && voiceGender === "female" ? (
                    t("Connecting...")
                  ) : (
                    <>
                      <span className="mr-2">👩</span>
                      {t("Start with Female Voice")}
                    </>
                  )}
                </Button>

                <Button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 flex items-center justify-center"
                  onClick={() => {
                    console.log("🎤 [BUTTON CLICK] Male voice button clicked")
                    startCall("male")
                  }}
                  disabled={isConnecting}
                >
                  {isConnecting && voiceGender === "male" ? (
                    t("Connecting...")
                  ) : (
                    <>
                      <span className="mr-2">👨</span>
                      {t("Start with Male Voice")}
                    </>
                  )}
                </Button>

                {networkError && !bypassNetworkCheck && (
                  <Button
                    variant="outline"
                    onClick={forceStartCall}
                    disabled={isConnecting}
                    className="text-sm bg-transparent"
                  >
                    {t("Start Without Network Check")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`h-16 w-16 rounded-full flex items-center justify-center ${
                      isAiSpeaking ? "bg-green-100 animate-pulse" : "bg-gray-100"
                    }`}
                  >
                    <Brain className={`h-8 w-8 ${isAiSpeaking ? "text-green-600" : "text-gray-600"}`} />
                  </div>
                </div>

                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    {isAiSpeaking
                      ? shouldUseGoogleTTS(currentLanguage.code)
                        ? t("AI speaking with Google TTS ({{gender}}) in {{language}}...", {
                            gender: voiceGender === "female" ? t("Female") : t("Male"),
                            language: currentLanguage.name,
                          })
                        : t("AI is speaking ({{gender}}) in {{language}}...", {
                            gender: voiceGender === "female" ? t("Female") : t("Male"),
                            language: currentLanguage.name,
                          })
                      : isListening
                        ? t("Listening in {{language}}...", { language: currentLanguage.name })
                        : isMicMuted
                          ? t("Microphone muted")
                          : t("Ready to listen in {{language}}", { language: currentLanguage.name })}
                  </p>
                  {isListening && (
                    <div className="flex justify-center mt-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div
                          className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {(transcript || interimTranscript) && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-blue-700 mb-1">
                      {t("You said in {{language}}:", { language: currentLanguage.name })}
                    </p>
                    <p className="text-sm text-blue-800">
                      {transcript}
                      {interimTranscript && <span className="text-blue-500 italic"> {interimTranscript}</span>}
                    </p>
                  </div>
                )}

                {aiResponse && (
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-green-700 mb-1 flex items-center">
                      {t("AI Psychologist in {{language}}:", { language: currentLanguage.name })}
                      {shouldUseGoogleTTS(currentLanguage.code) && (
                        <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                          Google TTS - {voiceGender === "female" ? t("Female") : t("Male")}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-green-800">{aiResponse}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center space-x-4 pt-4 border-t">
                <Button
                  variant={isMicMuted ? "default" : "outline"}
                  size="icon"
                  onClick={toggleMute}
                  className={`h-12 w-12 rounded-full ${
                    isMicMuted ? "bg-red-500 hover:bg-red-600 text-white" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={endCall}
                  className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600"
                >
                  <Phone className="h-5 w-5 transform rotate-[135deg]" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function extractPlainText(responseData: any): string {
  let aiResponseText = ""

  if (typeof responseData === "string") {
    aiResponseText = responseData.replace(/^\s*[[{"]|[\]}"]$\s*/g, "").trim()
  } else if (responseData && typeof responseData === "object") {
    if (responseData.response) aiResponseText = responseData.response
    else if (responseData.text) aiResponseText = responseData.text
    else if (responseData.message) aiResponseText = responseData.message
    else if (responseData.output) aiResponseText = responseData.output
    else if (responseData.content) aiResponseText = responseData.content
    else if (responseData.result) aiResponseText = responseData.result
    else if (Array.isArray(responseData) && responseData.length > 0) {
      const firstItem = responseData[0]
      if (typeof firstItem === "string") {
        aiResponseText = firstItem
      } else if (firstItem && typeof firstItem === "object") {
        if (firstItem.response) aiResponseText = firstItem.response
        else if (firstItem.text) aiResponseText = firstItem.text
        else if (firstItem.message) aiResponseText = firstItem.message
        else if (firstItem.output) aiResponseText = firstItem.output
      }
    }

    if (!aiResponseText && typeof responseData === "object") {
      try {
        const jsonString = JSON.stringify(responseData)
        aiResponseText = jsonString
          .replace(/^\s*[{[]|\s*[}\]]$/g, "")
          .replace(/"(\w+)":/g, "")
          .replace(/["{}[\],]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      } catch (e) {
        console.log("Error cleaning JSON:", e)
      }
    }
  }

  return aiResponseText
}

function cleanResponseText(text: string): string {
  if (!text) return ""

  return text
    .replace(/^\s*[{[]|\s*[}\]]$/g, "")
    .replace(/"output":|"response":|"text":|"message":|"content":/g, "")
    .replace(/["{}[\],]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\\n\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\/n\/n/g, " ")
    .replace(/\/n/g, " ")
    .replace(/\n\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/```/g, "")
    .replace(/`/g, "")
    .replace(/#/g, "")
    .replace(/>/g, "")
    .replace(/\|/g, "")
    .replace(/~/g, "")
    .replace(/_/g, "")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\s\/\s/g, " ")
    .replace(/^\//g, "")
    .replace(/\/$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
