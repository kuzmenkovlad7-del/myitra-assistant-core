"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { X, Mic, MicOff, Camera, CameraOff, Phone, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import {
  getLocaleForLanguage,
  getNativeSpeechParameters,
  getNativeVoicePreferences,
} from "@/lib/i18n/translation-utils"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"
import type { HTMLVideoElement } from "react"
import { Brain } from "lucide-react"

// Google Cloud TTS credentials for Ukrainian voices
const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS = {
  type: "service_account",
  project_id: "strong-maker-471022-s6",
  private_key_id: "dc48898af9911d21c7959fd5b13bb28db7ea1354",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCuFvlHiJgmSpjv\n9stiMzxxidgqxcN2/ralj7zgkkjXXhOgikfeOhBpjvjBeLDgLxNynA7DjoQ8wHbf\ngdrRuCqnrg83NC/FXTLHDRXXLW+megwcNLu3Kl7gR7q8iABBw1FaZxFnjduejnti\nAx3ZQnAFB9Uw2U9bQBh2TejD225TEJnyqiuecVD9pkAZE8aeN5ZgPnljLMjzkfk\njKSeZMU+2kHdcs4YCQ4ShNG2C7eL7mWsj1RpG9KKnOlkMlaZ8noM++pO4q7mCzc5\nDOUDv9gpCXKG1324KgZug1k3KNjlyTdGs7r/MFcUHFRNWUOpCMdxkIdPLRMlWJT\nlF7uQabxAgMBAAECggEABbY6wRJV/aGicXMdOrBYKhh9929MKb4TM4zrA0pBahGL\n3s9SqtOoYLJAbqadVQmuX2sH3/ov1AdzjwNFcO6UNbK0DJlhfN4BMb836Xqz6Fgm\nSBGh3BFfkgfAdHmY2o+EPo1VqJpiq4ncuftEVsohnwP6AC+2BWUrZ0p3dRnnPXZZ\nad02aThfaG73awScY5T0rotCIlq5M2z748EoBKHPUKELFunq5EiPiQfSIynO/Gpm\nayNtJ8OH8eQXNEnr5ixa/lo3L3g8w2cA+DnMTrFX1UGsbgoGgbY9/8c4bSEAcjUA\na6U8NxTb9jqjDcnIeXmG6XW3Qhhu385EwqvGQSg4HQKBgQm2AQfF/RKkjbKworS\nXZfaBVgsMqR7pkqnOX54Fr/Y0mkdY6qjh4rG+OBo2GHLn+VRLSbWVSmpy962cZWo\nXHdi9n4rMSXApxLoYdb9pNeYrNO6uxxC+DM7R2tTI8J6LtyuTEsw9s/AOYkP/Skf\nUswHgqexqpZ3pAnZS3Ova7njRQKBgQDBD6gGwOa7krhpfgwJnhd7ver+Bar8VN1E\n2QFnCpETx2NGtZtOKwD2k+Zn+Ydv/+TSaSj6kERgjqDBvSj/XU8kNN2Wdc22nwW\nnnLTo2fusaKpZP3OWdgNUMv7cC7RKjK5ZecO0JZGRF7f+6N4zs2707cbxAf0qR+S\nzTDbNii5vQKBgQCWe0bkhhcH7ZyuPHeGfuCYjVdXKIQ03shXjpE084+IZlGDiQ8Z\nnygGYQLZFgVaWheA/XAN1GJef7nlMNIgeHaTGqBQw68akU8wEWe23Rh2PGOhnIvl\n1CqBgCMkhXEneRj+vlldx+bSJi+FLsD53F2In9F1bgC8aUDKV/dH6W+6CQKBgQCy\nA4quN35JJH9QHj5hO9lxauvcMEO6CVJBYkrtxQuCjk4W6+t5ByQLONKxuqXhC6FQ\nIQ5jaeN3jnn/SRGYiGNqZivlq+9Kj+jtPkqopLp3mGlhAlMYyzTxCjgb7xPsH5nH\n45NK0MBPqElHBBN2mFGRSCVFv9qKGMuZJARRjL2+jQKBgQDVV50qRixSs2PkfbQa\n+NsCz16EHBFTz8mGkPtNZtWB2eZUK3toxmDw+iZormjPN8IxdgVjUmH4nA+PVMg9\nzcg+vXDBQlkD+lr3LDxi6vWfThbC1aY8W34qCjPBFYYPGH8W8sWUMSi3188I5P3cI\ntI/Wlzv7csphuz620VfkkJlHjw==\n-----END PRIVATE KEY-----\n",
  client_email: "tts-service-1@strong-maker-471022-s6.iam.gserviceaccount.com",
  client_id: "103107984061473463379",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/tts-service-1%40strong-maker-471022-s6.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
}

// Voice configurations for Ukrainian - Dr. Alexander's correct voice
const VIDEO_CALL_VOICE_CONFIGS = {
  uk: {
    female: {
      languageCode: "uk-UA",
      name: "uk-UA-Standard-A",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar",
      ssmlGender: "MALE",
    },
  },
}

// ==============================
// TYPES AND INTERFACES
// ==============================

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  voice: string
  animated?: boolean
  speakingVideo?: string
  idleVideo?: string
  speakingVideoNew?: string
}

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
    AudioContext?: any
    webkitAudioContext?: any
  }
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  webhookUrl: string
  openAiApiKey: string
  onError?: (error: Error) => void
}

// AI character options
const aiCharacters: AICharacter[] = [
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description: "Senior psychologist specializing in cognitive behavioral therapy with 15+ years of experience",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    voice: "en-US-GuyNeural",
    animated: true,
    idleVideo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
    speakingVideo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/doc_2025-06-19_20-29-04-QF7QyAGKBJ4Abilc0beRV9jP7VDO7i.mp4",
  },
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description: "Clinical psychologist specializing in anxiety, depression, and workplace stress management",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    voice: "en-US-JennyNeural",
    animated: true,
    idleVideo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
    speakingVideo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG111211_6034-6fD2w1l0V94iXV7x4VeGW74NHbtZrk.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description: "Psychotherapist specializing in emotional regulation, trauma recovery, and relationship counseling",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    voice: "en-US-JennyNeural",
    animated: true,
    idleVideo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9963-sneJ4XhoEuemkYgVb425Mscu7X9OC6.MP4",
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
    speakingVideo: "/videos/dr-maria-speaking.mp4",
  },
]

export default function VideoCallDialog({ isOpen, onClose, webhookUrl, openAiApiKey, onError }: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  // Character and call state
  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Media controls - START WITH MIC MUTED
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  // Permissions state
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [showPermissionsPrompt, setShowPermissionsPrompt] = useState(false)

  // Avatar settings
  const [showSettings, setShowSettings] = useState(false)
  const [avatarSensitivity, setAvatarSensitivity] = useState(0.8)

  // Speech and transcription
  const [transcript, setTranscript] = useState<string>("")
  const [interimTranscript, setInterimTranscript] = useState<string>("")
  const [aiResponse, setAiResponse] = useState<string>("")
  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<"listening" | "thinking" | "speaking">("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)

  // Processing state
  const [lastProcessedText, setLastProcessedText] = useState<string>("")
  const [isWaitingForUser, setIsWaitingForUser] = useState(false)
  const [speechStartTime, setSpeechStartTime] = useState<number>(0)

  // Video state
  const [currentVideoState, setCurrentVideoState] = useState<"idle" | "speaking">("idle")

  // Refs
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef<boolean>(false)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const reconnectAttemptRef = useRef<number>(0)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isVoicingRef = useRef<boolean>(false)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const processTranscriptionRef = useRef<((text: string) => Promise<void>) | null>(null)

  const isMicMutedRef = useRef<boolean>(isMicMuted)
  const isCallActiveRef = useRef<boolean>(isCallActive)

  const [audioInitialized, setAudioInitialized] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Get current language settings
  const currentLocale = getLocaleForLanguage(currentLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  const hasEnhancedVideo = selectedCharacter?.idleVideo && selectedCharacter?.speakingVideoNew

  // Check microphone and camera permissions
  const checkMediaPermissions = useCallback(async (): Promise<{
    hasPermissions: boolean
    microphoneGranted: boolean
    cameraGranted: boolean
    error?: string
  }> => {
    console.log("🔐 Checking media permissions...")

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          hasPermissions: false,
          microphoneGranted: false,
          cameraGranted: false,
          error: t("Your browser does not support audio/video features required for video calls."),
        }
      }

      let microphoneGranted = false
      let cameraGranted = false
      let microphoneError = ""
      let cameraError = ""

      // Test microphone access
      try {
        console.log("🎤 Testing microphone access...")
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        microphoneGranted = true
        console.log("✅ Microphone access granted")
        // Stop the test stream immediately
        micStream.getTracks().forEach((track) => track.stop())
      } catch (micError: any) {
        console.error("❌ Microphone access denied:", micError)
        if (micError.name === "NotAllowedError" || micError.name === "PermissionDeniedError") {
          microphoneError = t("Microphone access was denied. Please allow microphone access in your browser settings.")
        } else if (micError.name === "NotFoundError") {
          microphoneError = t("No microphone found. Please connect a microphone and try again.")
        } else {
          microphoneError = t("Unable to access microphone. Error: {{error}}", { error: micError.message })
        }
      }

      // Test camera access
      try {
        console.log("📹 Testing camera access...")
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        })
        cameraGranted = true
        console.log("✅ Camera access granted")
        // Stop the test stream immediately
        camStream.getTracks().forEach((track) => track.stop())
      } catch (camError: any) {
        console.error("❌ Camera access denied:", camError)
        if (camError.name === "NotAllowedError" || camError.name === "PermissionDeniedError") {
          cameraError = t("Camera access was denied. Please allow camera access in your browser settings.")
        } else if (camError.name === "NotFoundError") {
          cameraError = t("No camera found. Please connect a camera and try again.")
        } else {
          cameraError = t("Unable to access camera. Error: {{error}}", { error: camError.message })
        }
      }

      // Both must be granted
      if (microphoneGranted && cameraGranted) {
        console.log("✅ All permissions granted")
        return {
          hasPermissions: true,
          microphoneGranted: true,
          cameraGranted: true,
        }
      }

      // Build error message
      const errors = []
      if (microphoneError) errors.push(microphoneError)
      if (cameraError) errors.push(cameraError)

      return {
        hasPermissions: false,
        microphoneGranted,
        cameraGranted,
        error: errors.join(" "),
      }
    } catch (error: any) {
      console.error("❌ Error checking permissions:", error)
      return {
        hasPermissions: false,
        microphoneGranted: false,
        cameraGranted: false,
        error: t("Unable to check media permissions. Please ensure your browser supports audio/video features."),
      }
    }
  }, [t])

  // Clean up response text
  const cleanResponseText = useCallback((text: string) => {
    if (!text) return ""

    if (text.startsWith('[{"output":')) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) {
          return parsed[0].output.trim()
        }
      } catch (e) {
        console.log("Failed to parse response format:", e)
      }
    }

    return text.replace(/\n\n/g, " ").replace(/\*\*/g, "").replace(/\n/g, " ").replace(/```/g, "").trim()
  }, [])

  // Enhanced voice selection for non-Ukrainian languages
  const getRefinedVoiceForLanguage = useCallback(
    (langCode: string, preferredGender: "female" | "male" = "female"): SpeechSynthesisVoice | null => {
      if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported")
        return null
      }

      const cacheKey = `${langCode}-${preferredGender}`

      if (voiceCacheRef.current.has(cacheKey)) {
        const cachedVoice = voiceCacheRef.current.get(cacheKey)!
        console.log(`✓ Using cached native voice: ${cachedVoice.name} for ${langCode} ${preferredGender}`)
        return cachedVoice
      }

      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        console.warn("No voices available yet")
        return null
      }

      console.log(`🎯 Finding native voice for ${langCode} ${preferredGender} from ${voices.length} voices`)

      const nativeVoices = nativeVoicePreferences[langCode]?.[preferredGender] || []

      // Phase 1: Exact matches from native preferences
      for (const voiceName of nativeVoices) {
        const exactMatch = voices.find((v) => v.name === voiceName)
        if (exactMatch) {
          console.log(`✅ NATIVE exact match: ${exactMatch.name} for ${langCode} ${preferredGender}`)
          voiceCacheRef.current.set(cacheKey, exactMatch)
          return exactMatch
        }
      }

      // Phase 2: Partial matches
      for (const voiceName of nativeVoices) {
        const partialMatch = voices.find(
          (v) =>
            v.name.includes(voiceName) ||
            voiceName.includes(v.name) ||
            v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
            voiceName.toLowerCase().includes(v.name.toLowerCase()),
        )
        if (partialMatch) {
          console.log(`✅ NATIVE partial match: ${partialMatch.name} for ${langCode} ${preferredGender}`)
          voiceCacheRef.current.set(cacheKey, partialMatch)
          return partialMatch
        }
      }

      // Phase 3: Language-based search
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
            score += 40
          }

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
          ]
          if (nativeVoiceNames.some((nv) => lowerName.includes(nv))) {
            score += 45
          }

          if (lowerLang.startsWith(langCode.toLowerCase())) {
            score += 20
          }

          if (!voice.default) score += 12
          if (voice.localService) score += 10

          return { voice, score }
        })

        scoredVoices.sort((a, b) => b.score - a.score)
        const bestVoice = scoredVoices[0].voice

        console.log(`✅ NATIVE language fallback: ${bestVoice.name} (score: ${scoredVoices[0].score})`)
        voiceCacheRef.current.set(cacheKey, bestVoice)
        return bestVoice
      }

      // Phase 4: Cross-language fallbacks
      console.warn(`⚠️ No ${langCode} voices found, using cross-language fallbacks`)

      if (langCode !== "en") {
        const englishVoice = getRefinedVoiceForLanguage("en", preferredGender)
        if (englishVoice) {
          console.log(`✅ Using English voice for ${langCode}: ${englishVoice.name}`)
          voiceCacheRef.current.set(cacheKey, englishVoice)
          return englishVoice
        }
      }

      if (voices.length > 0) {
        const lastResortVoice = voices[0]
        console.log(`⚠️ Last resort voice: ${lastResortVoice.name}`)
        voiceCacheRef.current.set(cacheKey, lastResortVoice)
        return lastResortVoice
      }

      console.error(`❌ No voices available`)
      return null
    },
    [nativeVoicePreferences],
  )

  // Setup microphone
  const setupMicrophone = useCallback(async () => {
    try {
      console.log("🎤 Setting up microphone...")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      })

      microphoneStreamRef.current = stream
      console.log("✅ Microphone stream captured successfully")

      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.onended = () => {
          console.log("🎤 Audio track ended - attempting reconnection")
          if (isCallActive && !isMicMuted) {
            // Call reconnectMicrophone directly without it being in dependency array
            reconnectMicrophoneRef.current?.()
          }
        }
      }

      return stream
    } catch (error) {
      console.error("❌ Error setting up microphone:", error)
      throw error
    }
  }, [isCallActive, isMicMuted]) // Removed reconnectMicrophone from dependencies

  const reconnectMicrophoneRef = useRef<(() => Promise<void>) | null>(null)

  // Reconnect microphone
  const reconnectMicrophone = useCallback(async () => {
    if (reconnectAttemptRef.current >= 3) {
      console.log("❌ Max reconnection attempts reached")
      return
    }

    reconnectAttemptRef.current++
    console.log(`🔄 Attempting to reconnect microphone (attempt ${reconnectAttemptRef.current})`)

    try {
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      await setupMicrophone()

      if (isCallActive && !isMicMuted) {
        startSpeechRecognitionRef.current?.()
      }

      console.log("✅ Microphone reconnected successfully")
      reconnectAttemptRef.current = 0
    } catch (error) {
      console.error("❌ Failed to reconnect microphone:", error)
      setTimeout(() => reconnectMicrophoneRef.current?.(), 2000 * reconnectAttemptRef.current)
    }
  }, [isCallActive, isMicMuted, setupMicrophone]) // Removed startSpeechRecognition from dependencies

  useEffect(() => {
    reconnectMicrophoneRef.current = reconnectMicrophone
  }, [reconnectMicrophone])

  const startSpeechRecognitionRef = useRef<(() => void) | null>(null)

  // Speech recognition - ALWAYS LISTENING (even when AI is speaking)
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.log("Speech recognition not supported")
      return
    }

    console.log("🎤 Starting speech recognition (continuous listening mode)")

    const recognitionInstance = new SpeechRecognition()

    recognitionInstance.continuous = true
    recognitionInstance.interimResults = true
    recognitionInstance.maxAlternatives = 3
    recognitionInstance.lang = currentLocale

    console.log(`🎤 Recognition language: ${currentLocale}`)

    let finalTranscriptBuffer = ""
    let silenceTimeout: NodeJS.Timeout | null = null

    recognitionInstance.onstart = () => {
      setIsListening(true)
      setActivityStatus("listening")
      console.log(`✅ Recognition started - listening continuously`)
    }

    recognitionInstance.onresult = async (event) => {
      let currentInterimTranscript = ""
      let hasNewFinalResult = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript.trim()
        const confidence = result[0].confidence || 0.5

        if (result.isFinal && transcript.length > 0 && confidence > 0.3) {
          finalTranscriptBuffer += transcript + " "
          hasNewFinalResult = true
          console.log(`📝 Final transcript: "${transcript}" (confidence: ${confidence})`)

          // Log if this is an interruption
          if (isAiSpeaking || isVoicingRef.current) {
            console.log("🔴 [USER INTERRUPTION] Detected while AI was speaking")
          }
        } else if (transcript.length > 0) {
          currentInterimTranscript += transcript
        }
      }

      if (currentInterimTranscript) {
        setInterimTranscript(currentInterimTranscript)
      }

      if (silenceTimeout) {
        clearTimeout(silenceTimeout)
      }

      silenceTimeout = setTimeout(() => {
        if (finalTranscriptBuffer.trim().length > 2) {
          const textToProcess = finalTranscriptBuffer.trim()

          if (textToProcess !== lastProcessedText && !isProcessingRef.current) {
            finalTranscriptBuffer = ""
            setInterimTranscript("")
            setIsWaitingForUser(false)

            setTranscript((prev) => (prev ? `${prev} ${textToProcess}` : textToProcess))

            console.log(`🎤 Processing after silence: "${textToProcess}"`)
            processTranscriptionRef.current?.(textToProcess)
          } else {
            finalTranscriptBuffer = ""
          }
        }
      }, 1500)

      if (hasNewFinalResult && finalTranscriptBuffer.trim().length > 2) {
        const textToProcess = finalTranscriptBuffer.trim()

        if (textToProcess !== lastProcessedText && !isProcessingRef.current) {
          finalTranscriptBuffer = ""
          setInterimTranscript("")
          setIsWaitingForUser(false)

          setTranscript((prev) => (prev ? `${prev} ${textToProcess}` : textToProcess))

          console.log(`🎤 Processing final result: "${textToProcess}"`)
          processTranscriptionRef.current?.(textToProcess)
        } else {
          finalTranscriptBuffer = ""
        }
      }
    }

    recognitionInstance.onerror = (event) => {
      console.log("Recognition error:", event.error)

      if (event.error === "no-speech" || event.error === "aborted") {
        return
      }

      if (event.error === "audio-capture" || event.error === "not-allowed") {
        console.log("Audio capture error - microphone remains in current state (user must manually toggle)")
        return
      }

      if (event.error === "language-not-supported") {
        console.log(`Language not supported, falling back to English`)
        recognitionInstance.lang = "en-US"
        setTimeout(() => {
          try {
            recognitionInstance.start()
          } catch (e) {
            console.log("Failed to restart with English:", e)
          }
        }, 1000)
        return
      }

      if (event.error === "network" && isCallActive && !isMicMuted) {
        setTimeout(() => {
          try {
            recognitionInstance.start()
            console.log("Restarting after network error")
          } catch (e) {
            console.log("Failed to restart:", e)
          }
        }, 2000)
      }
    }

    recognitionInstance.onend = () => {
      console.log("Recognition ended")

      if (silenceTimeout) {
        clearTimeout(silenceTimeout)
      }

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        console.log("🔄 Recognition ended - immediately restarting to maintain continuous listening")
        // Keep isListening true throughout - no gaps in listening mode

        try {
          recognitionInstance.start()
          setIsListening(true)
          console.log("✅ Recognition restarted immediately - microphone stays active")
        } catch (error) {
          // If immediate restart fails, try again after brief delay
          console.log("⚠️ Immediate restart failed, retrying:", error)
          setTimeout(() => {
            if (isCallActiveRef.current && !isMicMutedRef.current && recognitionRef.current) {
              try {
                recognitionInstance.start()
                setIsListening(true)
                console.log("✅ Recognition restarted on retry")
              } catch (retryError) {
                console.log("❌ Retry failed:", retryError)
              }
            }
          }, 100)
        }
      } else {
        setIsListening(false)
      }
    }

    try {
      recognitionInstance.start()

      recognitionRef.current = {
        stop: () => {
          try {
            if (silenceTimeout) {
              clearTimeout(silenceTimeout)
            }
            recognitionInstance.stop()
            console.log("Stopping recognition")
          } catch (e) {
            console.log("Error stopping:", e)
          }
        },
        start: () => {
          try {
            recognitionInstance.start()
            console.log("Starting recognition")
          } catch (e) {
            console.log("Error starting:", e)
          }
        },
      }
      startSpeechRecognitionRef.current = recognitionRef.current.start
    } catch (error) {
      console.log("Error starting recognition:", error)
    }
  }, [currentLocale, isCallActive, isMicMuted, lastProcessedText, isAiSpeaking]) // Removed processTranscription from dependencies

  // Browser TTS fallback for non-Ukrainian languages
  const fallbackToBrowserTTS = useCallback(
    (cleanText: string, gender: "male" | "female", cleanup: () => void) => {
      console.log(`🎤 [BROWSER TTS] Starting for ${selectedCharacter?.name} (${gender})`)

      if (!window.speechSynthesis) {
        console.error("❌ [BROWSER TTS] Not supported")
        cleanup()
        return
      }

      window.speechSynthesis.cancel()

      setTimeout(() => {
        try {
          // Start video animation for ALL characters
          setCurrentVideoState("speaking")

          if (hasEnhancedVideo) {
            if (idleVideoRef.current) {
              idleVideoRef.current.pause()
            }
            if (speakingVideoRef.current && selectedCharacter?.speakingVideoNew) {
              speakingVideoRef.current.currentTime = 0
              speakingVideoRef.current.play().catch((error) => {
                console.log("Speaking video error:", error)
              })
              console.log(`✅ [VIDEO] Browser TTS video started for ${selectedCharacter?.name}`)
            }
          }

          const utterance = new SpeechSynthesisUtterance()
          utterance.text = cleanText
          utterance.lang = currentLocale

          // Select voice
          const selectedVoice = getRefinedVoiceForLanguage(currentLanguage.code, gender)
          if (selectedVoice) {
            utterance.voice = selectedVoice
            console.log(`🎤 [BROWSER TTS] Using voice: ${selectedVoice.name}`)
          }

          const speechParameters = getNativeSpeechParameters(currentLanguage.code, gender)
          utterance.rate = speechParameters.rate
          utterance.pitch = speechParameters.pitch
          utterance.volume = speechParameters.volume

          currentUtteranceRef.current = utterance

          utterance.onend = () => {
            console.log(`✅ [BROWSER TTS] Completed for ${selectedCharacter?.name}`)
            cleanup()
          }

          utterance.onerror = (err) => {
            // "interrupted" is expected when user interrupts AI - not an error
            if (err.error === "interrupted") {
              console.log(`🔴 [BROWSER TTS] Interrupted for ${selectedCharacter?.name} (user interrupted)`)
            } else {
              console.error(`❌ [BROWSER TTS] Error for ${selectedCharacter?.name}:`, err.error)
            }
            cleanup()
          }

          setTimeout(() => {
            try {
              window.speechSynthesis.speak(utterance)
              console.log(`🎤 [BROWSER TTS] Started for ${selectedCharacter?.name}`)
            } catch (speakError) {
              console.error("❌ [BROWSER TTS] Speak error:", speakError)
              cleanup()
            }
          }, 100)
        } catch (innerError) {
          console.error("❌ [BROWSER TTS] Inner error:", innerError)
          cleanup()
        }
      }, 200)
    },
    [currentLocale, currentLanguage, hasEnhancedVideo, selectedCharacter, getRefinedVoiceForLanguage],
  )

  // Text-to-speech function
  const speakText = useCallback(
    async (text: string) => {
      // Guard clause: check if call is active
      if (!isCallActive) {
        console.log("🛑 Call not active - skipping speech")
        return
      }

      // Guard clause: check if sound is enabled
      if (!isSoundEnabled) {
        console.log("🔇 Sound disabled - skipping speech")
        return
      }

      // Guard clause: check if text is valid
      if (!text || !text.trim()) {
        console.log("⚠️ Empty text - skipping speech")
        return
      }

      // REMOVE guard clause that prevents interruption - new responses should always interrupt
      if (isVoicingRef.current || isAiSpeaking) {
        console.log("🔴 [INTERRUPT] New response arrived - stopping current speech to voice new one")

        // Stop current audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
          currentAudioRef.current.src = ""
          currentAudioRef.current = null
        }

        // Stop browser TTS
        if (currentUtteranceRef.current) {
          currentUtteranceRef.current = null
        }
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel()
        }

        // Reset states briefly
        setIsAiSpeaking(false)
        isVoicingRef.current = false

        console.log("✅ [INTERRUPT] Previous speech stopped, starting new one")
      }

      // Clean the text
      const cleanedText = cleanResponseText(text)
      if (!cleanedText) {
        console.log("⚠️ Empty cleaned text - skipping speech")
        return
      }

      // Lock speaking state
      console.log(`🎤 [START] Speaking for ${selectedCharacter?.name}`)
      setIsAiSpeaking(true)
      isVoicingRef.current = true
      setActivityStatus("speaking")
      setIsWaitingForUser(true)
      setSpeechStartTime(Date.now())

      const characterGender = selectedCharacter?.gender || "female"
      const isDrAlexander = selectedCharacter?.id === "dr-alexander"

      // CLEANUP FUNCTION - GUARANTEED TO RUN
      const cleanup = () => {
        console.log(`🧹 [CLEANUP] Cleaning up speech for ${selectedCharacter?.name}`)

        try {
          // Stop any audio
          if (currentAudioRef.current) {
            currentAudioRef.current.pause()
            currentAudioRef.current.currentTime = 0
            currentAudioRef.current.src = ""
            currentAudioRef.current = null
          }

          // Stop any browser TTS
          if (currentUtteranceRef.current) {
            currentUtteranceRef.current = null
          }
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
          }

          // Reset states
          setIsAiSpeaking(false)
          isVoicingRef.current = false
          if (!isMicMuted) {
            setActivityStatus("listening")
            // Ensure recognition is running if mic is unmuted
            if (!isListening && recognitionRef.current) {
              console.log("🔄 Restarting recognition after speech ended")
              startSpeechRecognitionRef.current?.()
            }
          }
          setIsWaitingForUser(false)

          // Reset video to idle
          setCurrentVideoState("idle")

          // Stop speaking video and start idle video
          if (hasEnhancedVideo) {
            if (speakingVideoRef.current) {
              speakingVideoRef.current.pause()
              speakingVideoRef.current.currentTime = 0
            }
            if (idleVideoRef.current && selectedCharacter?.idleVideo && isCallActive) {
              idleVideoRef.current.currentTime = 0
              idleVideoRef.current.play().catch((e) => console.log("Idle video play error:", e))
            }
          } else {
            if (speakingVideoRef.current) {
              speakingVideoRef.current.pause()
              speakingVideoRef.current.currentTime = 0
            }
          }

          console.log(`✅ [CLEANUP COMPLETE] for ${selectedCharacter?.name}`)
        } catch (cleanupError) {
          console.error("❌ [CLEANUP ERROR]:", cleanupError)
        }

        // DO NOT restart microphone - it should always be listening
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current)
        }
      }

      try {
        // USE GOOGLE TTS FOR UKRAINIAN
        if (shouldUseGoogleTTS(currentLanguage.code)) {
          console.log(
            `🎤 [GOOGLE TTS] Generating for ${selectedCharacter?.name} (${characterGender}) in ${currentLanguage.name}`,
          )

          try {
            // STEP 1: Generate audio from Google TTS
            const audioDataUrl = await generateGoogleTTS(
              cleanedText,
              currentLanguage.code,
              characterGender,
              VIDEO_CALL_GOOGLE_TTS_CREDENTIALS,
              VIDEO_CALL_VOICE_CONFIGS,
            )

            if (!audioDataUrl) {
              throw new Error("No audio data received from Google TTS")
            }

            console.log(`✅ [GOOGLE TTS] Audio generated for ${selectedCharacter?.name}`)

            // STEP 2: Switch video to speaking mode FIRST for ALL characters
            console.log(`🎬 [VIDEO] Switching to speaking mode for ${selectedCharacter?.name}`)
            setCurrentVideoState("speaking")

            // STEP 3: Start speaking video for ALL characters
            if (hasEnhancedVideo) {
              // Pause idle video
              if (idleVideoRef.current) {
                idleVideoRef.current.pause()
              }

              // Start speaking video
              if (speakingVideoRef.current && selectedCharacter?.speakingVideoNew) {
                speakingVideoRef.current.currentTime = 0
                await speakingVideoRef.current.play().catch((e) => {
                  console.log("Speaking video play error:", e)
                })
                console.log(`✅ [VIDEO] Speaking video started for ${selectedCharacter?.name}`)
              }
            }

            // STEP 4: Create and configure audio element with mobile support
            const audio = new Audio()
            currentAudioRef.current = audio

            audio.preload = "auto"
            audio.volume = 1.0
            audio.playsInline = true // iOS requirement
            audio.crossOrigin = "anonymous" // CORS support

            audio.setAttribute("playsinline", "true")
            audio.setAttribute("webkit-playsinline", "true")

            // Setup event handlers BEFORE setting src
            let audioEnded = false
            let audioError = false

            audio.onended = () => {
              if (!audioEnded && !audioError) {
                audioEnded = true
                console.log(`✅ [AUDIO] Playback completed for ${selectedCharacter?.name}`)
                cleanup()
              }
            }

            audio.onerror = (error) => {
              if (!audioError && !audioEnded) {
                audioError = true
                // Check if this is an interruption by the user (not a real error)
                const target = error.target as HTMLAudioElement
                if (target && target.error && target.error.code === target.error.MEDIA_ERR_ABORTED) {
                  console.log(`🔴 [AUDIO] Playback interrupted for ${selectedCharacter?.name} (user interrupted)`)
                } else {
                  console.error(`❌ [AUDIO] Playback error for ${selectedCharacter?.name}:`, error)
                }
                cleanup()
              }
            }

            audio.oncanplaythrough = () => {
              console.log(`✅ [AUDIO] Ready to play for ${selectedCharacter?.name}`)
            }

            // STEP 5: Set audio source
            audio.src = audioDataUrl

            audio.load()

            // Wait for canplaythrough on mobile
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error("Audio load timeout")), 10000)
              audio.oncanplaythrough = () => {
                clearTimeout(timeout)
                resolve(true)
              }
              audio.onerror = () => {
                clearTimeout(timeout)
                reject(new Error("Audio load error"))
              }
            })

            // STEP 6: Apply character-specific delays
            // Dr. Alexander: 0ms delay for perfect sync
            // Dr. Sophia and Dr. Maria: 100ms delay for video stabilization
            const playDelay = isDrAlexander ? 0 : 100

            if (playDelay > 0) {
              await new Promise((resolve) => setTimeout(resolve, playDelay))
            }

            // STEP 7: Play audio
            try {
              await audio.play()
              console.log(
                `🎤 [AUDIO] Playback started for ${selectedCharacter?.name} (${characterGender}, delay: ${playDelay}ms)`,
              )
            } catch (playError) {
              console.error(`❌ [AUDIO] Play failed for ${selectedCharacter?.name}:`, playError)
              throw playError
            }
          } catch (googleTTSError) {
            console.error(`❌ [GOOGLE TTS] Failed for ${selectedCharacter?.name}:`, googleTTSError)
            // Fallback to browser TTS
            console.log(`🔄 [FALLBACK] Using browser TTS for ${selectedCharacter?.name}`)
            fallbackToBrowserTTS(cleanedText, characterGender, cleanup)
          }
        } else {
          // Non-Ukrainian: use browser TTS
          fallbackToBrowserTTS(cleanedText, characterGender, cleanup)
        }
      } catch (error) {
        console.error(`❌ [SPEECH ERROR] for ${selectedCharacter?.name}:`, error)
        cleanup()
      }
    },
    [
      isCallActive,
      isSoundEnabled,
      cleanResponseText,
      currentLanguage,
      selectedCharacter,
      isAiSpeaking,
      hasEnhancedVideo,
      isMicMuted,
      isListening,
      fallbackToBrowserTTS,
    ],
  )

  // Load voices on mount
  useEffect(() => {
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          console.log(`✅ Loaded ${voices.length} voices`)
          const femaleVoice = getRefinedVoiceForLanguage(currentLanguage.code, "female")
          const maleVoice = getRefinedVoiceForLanguage(currentLanguage.code, "male")
          if (femaleVoice) console.log(`✅ Pre-cached female: ${femaleVoice.name}`)
          if (maleVoice) console.log(`✅ Pre-cached male: ${maleVoice.name}`)
        }
      }
      loadVoices()
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
      }
    }
  }, [currentLanguage.code, getRefinedVoiceForLanguage])

  // Process transcription
  const processTranscription = useCallback(
    async (text: string) => {
      if (!isCallActive) {
        console.log("🛑 Call not active - ignoring speech")
        return
      }

      if (isProcessingRef.current || !text.trim()) {
        console.log("⏭️ Already processing or empty text")
        return
      }

      if (text === lastProcessedText) {
        console.log("⏭️ Duplicate text - skipping")
        return
      }

      // INTERRUPT: Stop any ongoing speech immediately
      if (isAiSpeaking || isVoicingRef.current) {
        console.log("🔴 [INTERRUPT] User interrupted AI - stopping current speech")

        // Stop audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
          currentAudioRef.current.src = ""
          currentAudioRef.current = null
        }

        // Stop browser TTS
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          console.log("🔴 [INTERRUPT] Canceling browser TTS")
          window.speechSynthesis.cancel()
        }
        if (currentUtteranceRef.current) {
          currentUtteranceRef.current = null
        }

        // Reset speaking states
        setIsAiSpeaking(false)
        isVoicingRef.current = false
        setCurrentVideoState("idle")

        // Stop speaking video and start idle video
        if (hasEnhancedVideo) {
          if (speakingVideoRef.current) {
            speakingVideoRef.current.pause()
            speakingVideoRef.current.currentTime = 0
          }
          if (idleVideoRef.current && selectedCharacter?.idleVideo) {
            idleVideoRef.current.currentTime = 0
            idleVideoRef.current.play().catch((e) => console.log("Idle video error:", e))
          }
        }

        console.log("✅ [INTERRUPT] Current speech stopped")
      }

      isProcessingRef.current = true
      setActivityStatus("thinking")

      try {
        console.log(`📤 Processing: "${text}"`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const params = new URLSearchParams({
          text: text,
          language: currentLanguage.code,
          languageName: currentLanguage.name,
          locale: currentLocale,
          user: user?.email || "guest@example.com",
          requestType: "video_call",
          voiceGender: selectedCharacter?.gender || "female",
          characterName: selectedCharacter?.name || "AI Psychologist",
        })

        const webhookResponse = await fetch(
          `https://myitra.app.n8n.cloud/webhook/99d30fb7-c3c8-44e8-8231-224d1c394c59?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Accept-Language": currentLanguage.code,
              "Content-Language": currentLanguage.code,
            },
            signal: controller.signal,
          },
        )

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          throw new Error(`Webhook error: ${webhookResponse.status}`)
        }

        let responseData
        const contentType = webhookResponse.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          responseData = await webhookResponse.json()
        } else {
          const textResponse = await webhookResponse.text()
          try {
            responseData = JSON.parse(textResponse)
          } catch (e) {
            responseData = { response: textResponse }
          }
        }

        console.log(`📥 Response received:`, responseData)

        let aiResponseText = ""

        if (typeof responseData === "string") {
          aiResponseText = responseData
        } else if (responseData && typeof responseData === "object") {
          if (Array.isArray(responseData) && responseData.length > 0) {
            const firstItem = responseData[0]
            aiResponseText =
              firstItem.output || firstItem.response || firstItem.text || firstItem.message || JSON.stringify(firstItem)
          } else {
            aiResponseText =
              responseData.response ||
              responseData.text ||
              responseData.message ||
              responseData.output ||
              responseData.content ||
              responseData.result ||
              JSON.stringify(responseData)
          }
        }

        const cleanedResponse = cleanResponseText(aiResponseText)

        if (!cleanedResponse || cleanedResponse.trim().length === 0) {
          throw new Error("Empty response received")
        }

        if (isCallActive) {
          setLastProcessedText(text)
          console.log(`📝 Final response: "${cleanedResponse.substring(0, 100)}..."`)

          // Display text immediately
          setAiResponse(cleanedResponse)
          setActivityStatus("listening")

          // Start voice playback
          setTimeout(() => {
            if (isCallActive) {
              speakText(cleanedResponse)
            }
          }, 100)
        }
      } catch (error: any) {
        console.error("❌ Processing error:", error)

        if (!isCallActive) {
          console.log("Call ended - ignoring error")
          return
        }

        let errorMessage = ""
        if (error.name === "AbortError") {
          errorMessage = t("Connection timeout. Please try again.")
        } else if (error.message === "Empty response received") {
          errorMessage = t("I received your message but couldn't generate a response. Could you try rephrasing?")
        } else {
          errorMessage = t("I couldn't process your message. Could you try again.")
        }

        if (isCallActive) {
          setAiResponse(errorMessage)
        }
      } finally {
        isProcessingRef.current = false
        if (isCallActive) {
          setActivityStatus("listening")
        }
      }
    },
    [
      currentLanguage.code,
      currentLanguage.name,
      currentLocale,
      t,
      user?.email,
      selectedCharacter,
      speakText,
      cleanResponseText,
      lastProcessedText,
      isCallActive,
      isAiSpeaking,
      hasEnhancedVideo,
    ],
  )

  useEffect(() => {
    processTranscriptionRef.current = processTranscription
  }, [processTranscription])

  // Toggle microphone
  const toggleMicrophone = useCallback(() => {
    if (isMicMuted) {
      console.log("🎤 Unmuting microphone - starting continuous listening")
      setIsMicMuted(false)
      setIsListening(true)
      setActivityStatus("listening")
      startSpeechRecognitionRef.current?.()
    } else {
      console.log("🎤 Muting microphone - stopping listening")
      if (recognitionRef.current && recognitionRef.current.stop) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      setInterimTranscript("")
      setIsMicMuted(true)
    }
  }, [isMicMuted]) // Removed startSpeechRecognition from dependencies

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  // Update startSpeechRecognitionRef when startSpeechRecognition changes
  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition
  }, [startSpeechRecognition])

  // Handle camera access
  useEffect(() => {
    if (isCallActive && !isCameraOff && userVideoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
        })
        .catch((error) => {
          console.log("Camera error:", error)
          setIsCameraOff(true)
        })
    }

    return () => {
      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
    }
  }, [isCallActive, isCameraOff])

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (isCameraOff) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
          setIsCameraOff(false)
          console.log("📹 Camera on")
        })
        .catch((error) => {
          console.log("Camera error:", error)
          alert(t("Could not access your camera. Please check your permissions."))
        })
    } else {
      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
      setIsCameraOff(true)
      console.log("📹 Camera off")
    }
  }, [isCameraOff, t])

  // Toggle sound
  const toggleSound = useCallback(() => {
    setIsSoundEnabled(!isSoundEnabled)

    if (isSoundEnabled && isAiSpeaking) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current = null
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }

    console.log(`🔊 Sound ${!isSoundEnabled ? "enabled" : "disabled"}`)
  }, [isSoundEnabled, isAiSpeaking])

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
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/jQwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
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

  // Start call with permissions check
  const startCall = useCallback(async () => {
    if (!selectedCharacter) {
      console.log("No character selected")
      return
    }

    setIsConnecting(true)
    setPermissionsError(null)
    setShowPermissionsPrompt(false)

    try {
      await initializeMobileAudio()

      // STEP 1: Check permissions BEFORE starting call
      console.log("🔐 Checking media permissions before starting call...")
      const permissionsCheck = await checkMediaPermissions()

      if (!permissionsCheck.hasPermissions) {
        // Permissions denied - show error and prompt
        console.error("❌ Media permissions not granted")
        setPermissionsError(permissionsCheck.error || t("Microphone and camera access required"))
        setShowPermissionsPrompt(true)
        setIsConnecting(false)
        return
      }

      console.log("✅ All permissions granted - proceeding with call")

      // STEP 2: Permissions granted - start call normally
      setIsCallActive(true)
      setCurrentVideoState("idle")
      setIsMicMuted(true)
      reconnectAttemptRef.current = 0

      await setupMicrophone()

      // Start continuous listening AFTER microphone setup
      if (isCallActive && !isMicMuted) {
        // Check isCallActive to ensure we are in the call state
        startSpeechRecognitionRef.current?.()
      }

      if (hasEnhancedVideo && selectedCharacter.idleVideo) {
        setTimeout(() => {
          if (idleVideoRef.current && isCallActive) {
            idleVideoRef.current.currentTime = 0
            idleVideoRef.current.play().catch((error) => {
              console.log("Idle video error:", error)
            })
          }
        }, 500)
      }

      console.log(`✅ Call started with ${selectedCharacter.name} - Mic MUTED`)
    } catch (error: any) {
      console.error("❌ Failed to start call:", error)
      setPermissionsError(
        error.message || t("Failed to start the call. Please check your microphone and camera permissions."),
      )
      setShowPermissionsPrompt(true)
    } finally {
      setIsConnecting(false)
    }
  }, [
    selectedCharacter,
    t,
    currentLanguage,
    hasEnhancedVideo,
    isCallActive,
    setupMicrophone,
    checkMediaPermissions,
    initializeMobileAudio,
  ])

  // Retry permissions - allow user to try again
  const retryPermissions = useCallback(() => {
    setPermissionsError(null)
    setShowPermissionsPrompt(false)
    // Immediately try to start call again
    startCall()
  }, [startCall])

  // End call
  const endCall = useCallback(() => {
    console.log("🛑 ENDING CALL")

    setIsCallActive(false)
    setIsListening(false)
    setIsWaitingForUser(false)
    setCurrentVideoState("idle")
    setActivityStatus("listening") // Set back to listening when call ends
    setIsMicMuted(true)
    isProcessingRef.current = false
    reconnectAttemptRef.current = 0

    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.log("Error stopping recognition:", error)
      }
      recognitionRef.current = null
    }

    try {
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (error) {
            console.log("Error stopping mic:", error)
          }
        })
        microphoneStreamRef.current = null
      }
    } catch (error) {
      console.log("Error stopping microphone:", error)
    }

    try {
      if (idleVideoRef.current) {
        idleVideoRef.current.pause()
        idleVideoRef.current.currentTime = 0
      }
    } catch (error) {
      console.log("Error stopping idle video:", error)
    }

    try {
      if (speakingVideoRef.current) {
        speakingVideoRef.current.pause()
        speakingVideoRef.current.currentTime = 0
      }
    } catch (error) {
      console.log("Error stopping speaking video:", error)
    }

    try {
      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (error) {
            console.log("Error stopping camera:", error)
          }
        })
        userVideoRef.current.srcObject = null
      }
    } catch (error) {
      console.log("Error stopping camera:", error)
    }

    setTranscript("")
    setInterimTranscript("")
    setAiResponse("")
    setLastProcessedText("")
    setSpeechStartTime(0)
    setSpeechError(null)

    console.log("🛑 CALL ENDED")
  }, [])

  // Clean up on close
  useEffect(() => {
    if (!isOpen && isCallActive) {
      endCall()
    }

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }

      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }

      if (currentUtteranceRef.current) {
        currentUtteranceRef.current = null
      }

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (idleVideoRef.current) {
        idleVideoRef.current.pause()
        idleVideoRef.current.currentTime = 0
      }
      if (speakingVideoRef.current) {
        speakingVideoRef.current.pause()
        speakingVideoRef.current.currentTime = 0
      }

      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
    }
  }, [isOpen, isCallActive, endCall])

  if (!isOpen) return null

  const userEmail = user?.email || "guest@example.com"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col h-[100dvh] sm:h-[90vh] max-h-none sm:max-h-[800px] overflow-hidden">
        <div className="p-3 sm:p-4 border-b flex justify-between items-center bg-primary-800 text-white rounded-t-xl relative">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-bold text-base sm:text-lg truncate">{t("AI Psychologist Video Call")}</h3>
            <div className="text-xs text-lavender-200 truncate">
              {t("User")}: {userEmail}
            </div>
            <div className="text-xs text-lavender-200 mt-1">
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
            {shouldUseGoogleTTS(currentLanguage.code) && (
              <div className="text-xs text-green-200 mt-1 flex items-center">
                <span className="mr-1">🎤</span>
                <span className="hidden sm:inline">{t("Google TTS Native Voice for ALL characters")}</span>
                <span className="sm:hidden">{t("Google TTS")}</span>
              </div>
            )}
          </div>

          <div className="absolute top-2 right-12 sm:right-16 flex flex-col gap-1">
            {speechError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs max-w-[120px] sm:max-w-none truncate">
                Error: {speechError}
              </div>
            )}
            {isCallActive && (
              <div
                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                  isMicMuted
                    ? "bg-red-100 border border-red-400 text-red-700"
                    : "bg-green-100 border border-green-400 text-green-700"
                }`}
              >
                🎤 {isMicMuted ? "Muted" : "Listening"}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-primary-700 min-w-[44px] min-h-[44px] flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col touch-pan-y">
          {!isCallActive ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-6 sm:mb-8 px-2">
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">{t("Choose Your AI Psychologist")}</h3>
                <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
                  {t("Select the AI psychologist you'd like to speak with during your video call.")}
                </p>
              </div>

              {showPermissionsPrompt && permissionsError && (
                <div className="mb-4 sm:mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-4 sm:p-6 w-full max-w-md mx-2">
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-red-800">{t("Permissions Required")}</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{permissionsError}</p>
                      </div>
                      <div className="mt-4">
                        <Button
                          onClick={retryPermissions}
                          className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 min-h-[44px]"
                        >
                          {t("Grant Permissions & Retry")}
                        </Button>
                      </div>
                      <div className="mt-3 text-xs text-red-600">
                        <p className="font-medium mb-1">{t("How to enable permissions")}:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>{t("Click the camera/microphone icon in your browser's address bar")}</li>
                          <li>{t("Select 'Allow' for both camera and microphone")}</li>
                          <li>{t("Click 'Grant Permissions & Retry' button above")}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center mx-2">
                <p className="text-sm font-medium text-blue-700 mb-1">{t("Video call language")}:</p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{currentLanguage.flag}</span>
                  {currentLanguage.name}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {shouldUseGoogleTTS(currentLanguage.code)
                    ? t("All characters use Google TTS for authentic native Ukrainian accent")
                    : t("AI will understand and respond in this language with native accent")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl px-2">
                {aiCharacters.map((character) => (
                  <div
                    key={character.id}
                    className={`relative bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-4 sm:p-6 border-2 ${
                      selectedCharacter?.id === character.id ? "border-primary-600" : "border-transparent"
                    }`}
                    onClick={() => setSelectedCharacter(character)}
                  >
                    <div className="relative w-full aspect-square mb-3 sm:mb-4 overflow-hidden rounded-lg">
                      <Image
                        src={character.avatar || "/placeholder.svg"}
                        alt={character.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        priority
                      />
                    </div>
                    <h4 className="font-semibold text-base sm:text-lg text-center mb-1 sm:mb-2">{character.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 sm:mb-4">{character.description}</p>
                    <Button
                      className={`w-full min-h-[44px] ${
                        selectedCharacter?.id === character.id
                          ? "bg-primary-600 hover:bg-primary-700"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCharacter(character)
                      }}
                    >
                      {selectedCharacter?.id === character.id ? t("Selected") : t("Select")}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-6 sm:mt-8 w-full max-w-md px-2">
                <Button
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-base sm:text-lg py-4 sm:py-6 min-h-[56px]"
                  onClick={startCall}
                  disabled={!selectedCharacter || isConnecting}
                >
                  {isConnecting ? t("Connecting...") : t("Start Video Call")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="relative w-full aspect-video sm:aspect-[16/10] bg-gray-900 rounded-lg overflow-hidden mb-3 sm:mb-4">
                <div className="absolute inset-0">
                  {hasEnhancedVideo ? (
                    <>
                      {selectedCharacter.idleVideo && (
                        <video
                          ref={idleVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover ${
                            currentVideoState === "idle" ? "opacity-100" : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source src={selectedCharacter.idleVideo} type="video/mp4" />
                        </video>
                      )}

                      {selectedCharacter.speakingVideoNew && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover ${
                            currentVideoState === "speaking" ? "opacity-100" : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source src={selectedCharacter.speakingVideoNew} type="video/mp4" />
                        </video>
                      )}
                    </>
                  ) : (
                    <>
                      {selectedCharacter && !isAiSpeaking && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-64 h-64 relative">
                            <Image
                              src={selectedCharacter.avatar || "/placeholder.svg"}
                              alt={selectedCharacter.name}
                              fill
                              className="object-cover rounded-full"
                              sizes="256px"
                            />
                          </div>
                        </div>
                      )}

                      {selectedCharacter?.speakingVideo && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover ${
                            isAiSpeaking ? "opacity-100" : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source src={selectedCharacter.speakingVideo} type="video/mp4" />
                        </video>
                      )}
                    </>
                  )}
                </div>

                <div
                  className={`absolute top-2 sm:top-4 right-2 sm:right-4 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                    activityStatus === "listening"
                      ? "bg-green-100 text-green-800"
                      : activityStatus === "thinking"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {activityStatus === "listening"
                    ? t("Listening in {{language}}...", { language: currentLanguage.name })
                    : activityStatus === "thinking"
                      ? t("Thinking...")
                      : shouldUseGoogleTTS(currentLanguage.code)
                        ? t("Speaking with Google TTS in {{language}}...", { language: currentLanguage.name })
                        : t("Speaking in {{language}}...", { language: currentLanguage.name })}
                </div>

                <div className="absolute top-2 sm:top-4 left-2 sm:left-4 px-2 sm:px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-medium flex items-center">
                  <span className="mr-1">{currentLanguage.flag}</span>
                  <span className="hidden sm:inline">{currentLanguage.name}</span>
                </div>

                {hasEnhancedVideo && (
                  <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 px-2 sm:px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs sm:text-sm font-medium flex items-center">
                    <span className="mr-1">🎬</span>
                    <span className="hidden sm:inline">
                      {currentVideoState === "speaking" ? t("Speaking Mode") : t("Listening Mode")}
                    </span>
                  </div>
                )}

                {!isCameraOff && (
                  <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-20 sm:w-1/4 aspect-video bg-gray-800 rounded overflow-hidden shadow-lg">
                    <video
                      ref={userVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover transform scale-x-[-1]"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto touch-pan-y">
                <div className="bg-primary-50 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-sm sm:text-base text-primary-800 mb-2 flex items-center flex-wrap">
                    <span>
                      {selectedCharacter ? selectedCharacter.name : t("AI Psychologist")} ({currentLanguage.name})
                    </span>
                    {shouldUseGoogleTTS(currentLanguage.code) && (
                      <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                        Google TTS
                      </span>
                    )}
                  </h4>
                  <div className="flex items-start">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary-200 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                      <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isAiSpeaking ? (
                        <div className="flex flex-col space-y-2">
                          <div className="flex space-x-2 items-center">
                            <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
                            <div
                              className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"
                              style={{ animationDelay: "0.4s" }}
                            ></div>
                            <span className="text-primary-600 text-xs sm:text-sm ml-2">
                              {shouldUseGoogleTTS(currentLanguage.code)
                                ? t("Speaking with Google TTS in {{language}}...", { language: currentLanguage.name })
                                : t("Speaking in {{language}}...", { language: currentLanguage.name })}
                            </span>
                          </div>
                          <div className="text-sm sm:text-base text-gray-700 mt-2 whitespace-pre-wrap break-words">
                            {aiResponse}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap break-words">
                          {aiResponse ||
                            (isMicMuted
                              ? t("Click the microphone button to start speaking")
                              : t("I'm listening. Please speak when you're ready."))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isListening && !isMicMuted && (
                  <div className="flex items-center justify-center">
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs sm:text-sm flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="hidden sm:inline">
                        {t("Listening in {{language}}...", { language: currentLanguage.name })}
                      </span>
                      <span className="sm:hidden">{t("Listening...")}</span>
                    </div>
                  </div>
                )}

                {interimTranscript && (
                  <div className="bg-gray-50 rounded-lg p-3 italic text-xs sm:text-sm text-gray-500 break-words">
                    {interimTranscript}...
                  </div>
                )}

                {transcript && (
                  <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
                    <h4 className="font-medium text-sm sm:text-base text-gray-800 mb-2">
                      <span className="hidden sm:inline">
                        {t("Your Speech in {{language}}", { language: currentLanguage.name })}
                      </span>
                      <span className="sm:hidden">{t("Your Speech")}</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-700 break-words">{transcript}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isCallActive && (
          <div className="p-3 sm:p-4 border-t bg-gray-50 flex flex-col safe-area-bottom">
            <div className="flex justify-center space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isMicMuted
                    ? "bg-red-100 text-red-600"
                    : isListening
                      ? "bg-green-100 text-green-600 animate-pulse"
                      : "bg-gray-100"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? <MicOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Mic className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"}`}
                onClick={toggleCamera}
              >
                {isCameraOff ? (
                  <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <Camera className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"}`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? (
                  <Volume2 className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <VolumeX className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-14 w-14 sm:h-12 sm:w-12 bg-red-600 hover:bg-red-700 text-white touch-manipulation"
                onClick={endCall}
              >
                <Phone className="h-6 w-6 sm:h-5 sm:w-5 transform rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
