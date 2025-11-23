"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

interface AvatarAnimationProps {
  isActive: boolean
  isSpeaking: boolean
  avatarImage: string
  className?: string
}

export default function AvatarAnimation({ isActive, isSpeaking, avatarImage, className = "" }: AvatarAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const animationFrameRef = useRef<number>()
  const [imageLoaded, setImageLoaded] = useState(false)

  // Animation state
  const animationStateRef = useRef({
    time: 0,
    mouthOpenness: 0,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    headRotation: 0,
    breathingOffset: 0,
    lastBlinkTime: 0,
  })

  // Animation parameters
  const params = {
    breathing: {
      amplitude: 2,
      frequency: 0.3,
    },
    speaking: {
      mouthFrequency: 8,
      mouthAmplitude: 0.8,
      headMovement: 0.5,
    },
    blinking: {
      frequency: 3000, // Average blink every 3 seconds
      duration: 150, // Blink duration in ms
    },
    idle: {
      headSway: {
        amplitude: 1,
        frequency: 0.1,
      },
    },
  }

  // Initialize canvas and image
  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current

    if (!canvas || !image) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [imageLoaded])

  // Animation loop
  useEffect(() => {
    if (!isActive || !imageLoaded) return

    const animate = (timestamp: number) => {
      const canvas = canvasRef.current
      const image = imageRef.current

      if (!canvas || !image) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const state = animationStateRef.current
      state.time = timestamp

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)

      // Calculate animations
      const breathingY = Math.sin(timestamp * params.breathing.frequency * 0.001) * params.breathing.amplitude

      let mouthOpenness = 0
      let headRotation = 0

      if (isSpeaking) {
        // Speaking animation
        mouthOpenness =
          (Math.sin(timestamp * params.speaking.mouthFrequency * 0.001) + 1) * 0.5 * params.speaking.mouthAmplitude
        headRotation = Math.sin(timestamp * params.speaking.mouthFrequency * 0.0005) * params.speaking.headMovement
      } else {
        // Idle head sway
        headRotation = Math.sin(timestamp * params.idle.headSway.frequency * 0.001) * params.idle.headSway.amplitude
      }

      // Blinking animation
      let eyeBlinkFactor = 0
      if (timestamp - state.lastBlinkTime > params.blinking.frequency + Math.random() * 2000) {
        state.lastBlinkTime = timestamp
      }

      const timeSinceLastBlink = timestamp - state.lastBlinkTime
      if (timeSinceLastBlink < params.blinking.duration) {
        const blinkProgress = timeSinceLastBlink / params.blinking.duration
        eyeBlinkFactor = Math.sin(blinkProgress * Math.PI)
      }

      // Save context for transformations
      ctx.save()

      // Center the image
      const canvasWidth = canvas.width / window.devicePixelRatio
      const canvasHeight = canvas.height / window.devicePixelRatio
      const imageAspect = image.naturalWidth / image.naturalHeight
      const canvasAspect = canvasWidth / canvasHeight

      let drawWidth, drawHeight, drawX, drawY

      if (imageAspect > canvasAspect) {
        // Image is wider than canvas
        drawHeight = canvasHeight
        drawWidth = drawHeight * imageAspect
        drawX = (canvasWidth - drawWidth) / 2
        drawY = 0
      } else {
        // Image is taller than canvas
        drawWidth = canvasWidth
        drawHeight = drawWidth / imageAspect
        drawX = 0
        drawY = (canvasHeight - drawHeight) / 2
      }

      // Apply transformations
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.rotate((headRotation * Math.PI) / 180)
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2 + breathingY)

      // Draw the main image
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)

      // Draw mouth overlay for speaking
      if (isSpeaking && mouthOpenness > 0.1) {
        ctx.save()
        ctx.globalAlpha = mouthOpenness * 0.3
        ctx.fillStyle = "#2a1810"

        // Simple mouth shape
        const mouthX = canvasWidth / 2
        const mouthY = canvasHeight * 0.7
        const mouthWidth = 20 * mouthOpenness
        const mouthHeight = 8 * mouthOpenness

        ctx.beginPath()
        ctx.ellipse(mouthX, mouthY, mouthWidth, mouthHeight, 0, 0, 2 * Math.PI)
        ctx.fill()
        ctx.restore()
      }

      // Draw eye blink overlay
      if (eyeBlinkFactor > 0.1) {
        ctx.save()
        ctx.globalAlpha = eyeBlinkFactor * 0.8
        ctx.fillStyle = "#f4c2a1" // Skin tone

        // Left eye
        const leftEyeX = canvasWidth * 0.42
        const leftEyeY = canvasHeight * 0.45
        ctx.beginPath()
        ctx.ellipse(leftEyeX, leftEyeY, 15, 3, 0, 0, 2 * Math.PI)
        ctx.fill()

        // Right eye
        const rightEyeX = canvasWidth * 0.58
        const rightEyeY = canvasHeight * 0.45
        ctx.beginPath()
        ctx.ellipse(rightEyeX, rightEyeY, 15, 3, 0, 0, 2 * Math.PI)
        ctx.fill()

        ctx.restore()
      }

      // Restore context
      ctx.restore()

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isActive, isSpeaking, imageLoaded])

  return (
    <div className={`relative ${className}`}>
      {/* Hidden image for loading */}
      <Image
        ref={imageRef}
        src={avatarImage || "/placeholder.svg"}
        alt="Avatar"
        width={400}
        height={400}
        className="hidden"
        onLoad={() => setImageLoaded(true)}
        priority
      />

      {/* Canvas for animation */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{ display: imageLoaded ? "block" : "none" }}
      />

      {/* Fallback image while loading */}
      {!imageLoaded && (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )}
    </div>
  )
}
