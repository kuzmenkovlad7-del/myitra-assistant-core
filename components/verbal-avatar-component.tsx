"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { VerbalAvatar } from "@/lib/verbal-avatar"

interface VerbalAvatarComponentProps {
  avatarImage: string
  isActive: boolean
  isSpeaking: boolean
  className?: string
  sensitivity?: number
  onError?: (error: Error) => void
}

export default function VerbalAvatarComponent({
  avatarImage,
  isActive,
  isSpeaking,
  className = "",
  sensitivity = 0.8,
  onError,
}: VerbalAvatarComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avatarRef = useRef<VerbalAvatar | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize avatar
  const initializeAvatar = useCallback(async () => {
    if (!canvasRef.current || avatarRef.current) return

    try {
      // Create audio context for lip sync
      if (!audioContextRef.current && typeof window !== "undefined") {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        } catch (e) {
          console.log("AudioContext not available:", e)
        }
      }

      // Initialize verbal avatar
      const avatar = new VerbalAvatar({
        canvas: canvasRef.current,
        avatarImage,
        audioContext: audioContextRef.current || undefined,
        enableLipSync: true,
        enableHeadMovement: true,
        sensitivity,
      })

      avatarRef.current = avatar
      setIsInitialized(true)
      setError(null)

      console.log("Verbal Avatar initialized successfully")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize avatar"
      console.error("Error initializing Verbal Avatar:", err)
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }, [avatarImage, sensitivity, onError])

  // Handle speaking state changes
  useEffect(() => {
    if (!avatarRef.current || !isInitialized) return

    if (isSpeaking) {
      avatarRef.current.startSpeaking()
    } else {
      avatarRef.current.stopSpeaking()
    }
  }, [isSpeaking, isInitialized])

  // Handle active state changes
  useEffect(() => {
    if (!avatarRef.current || !isInitialized) return

    if (isActive) {
      avatarRef.current.startAnimation()
    } else {
      avatarRef.current.stopAnimation()
    }
  }, [isActive, isInitialized])

  // Update sensitivity
  useEffect(() => {
    if (avatarRef.current && isInitialized) {
      avatarRef.current.updateSensitivity(sensitivity)
    }
  }, [sensitivity, isInitialized])

  // Initialize on mount
  useEffect(() => {
    initializeAvatar()

    return () => {
      if (avatarRef.current) {
        avatarRef.current.destroy()
        avatarRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [initializeAvatar])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [])

  // Handle audio context resume (required by some browsers)
  useEffect(() => {
    const handleUserInteraction = () => {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
    }

    document.addEventListener("click", handleUserInteraction, { once: true })
    document.addEventListener("touchstart", handleUserInteraction, { once: true })

    return () => {
      document.removeEventListener("click", handleUserInteraction)
      document.removeEventListener("touchstart", handleUserInteraction)
    }
  }, [])

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{
          display: isInitialized && !error ? "block" : "none",
        }}
      />

      {/* Loading state */}
      {!isInitialized && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing Avatar...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-center p-4">
            <div className="text-red-600 mb-2">⚠️ Avatar Error</div>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={initializeAvatar}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === "development" && isInitialized && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
          <div>Avatar: {isInitialized ? "✓" : "✗"}</div>
          <div>Speaking: {isSpeaking ? "✓" : "✗"}</div>
          <div>Active: {isActive ? "✓" : "✗"}</div>
          <div>Sensitivity: {sensitivity}</div>
        </div>
      )}
    </div>
  )
}
