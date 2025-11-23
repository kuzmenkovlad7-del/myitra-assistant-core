"use client"

// Verbal Avatar JS integration
// Based on https://github.com/antoineMoPa/verbal-avatar

interface VerbalAvatarConfig {
  canvas: HTMLCanvasElement
  avatarImage: string
  audioContext?: AudioContext
  enableLipSync?: boolean
  enableHeadMovement?: boolean
  sensitivity?: number
}

interface FaceFeatures {
  mouth: {
    x: number
    y: number
    width: number
    height: number
    openness: number
  }
  eyes: {
    left: { x: number; y: number; blink: number }
    right: { x: number; y: number; blink: number }
  }
  head: {
    rotation: number
    tilt: number
    nod: number
  }
}

export class VerbalAvatar {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gl: WebGLRenderingContext | null = null
  private avatarImage: HTMLImageElement | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null
  private animationFrame: number | null = null
  private isInitialized = false
  private isSpeaking = false
  private speechStartTime = 0

  // Animation state
  private faceFeatures: FaceFeatures = {
    mouth: { x: 0.5, y: 0.7, width: 0.08, height: 0.04, openness: 0 },
    eyes: {
      left: { x: 0.35, y: 0.4, blink: 0 },
      right: { x: 0.65, y: 0.4, blink: 0 },
    },
    head: { rotation: 0, tilt: 0, nod: 0 },
  }

  // Animation parameters
  private params = {
    lipSync: {
      sensitivity: 0.8,
      smoothing: 0.3,
      threshold: 0.01,
      maxOpenness: 0.8,
    },
    headMovement: {
      nodAmplitude: 0.02,
      swayAmplitude: 0.01,
      tiltAmplitude: 0.005,
      frequency: 0.5,
    },
    blinking: {
      frequency: 3000,
      duration: 150,
      randomness: 2000,
    },
    breathing: {
      amplitude: 0.003,
      frequency: 0.3,
    },
  }

  private lastBlinkTime = 0
  private breathingPhase = 0
  private headMovementPhase = 0

  constructor(config: VerbalAvatarConfig) {
    this.canvas = config.canvas
    const ctx = this.canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not get 2D context from canvas")
    }
    this.ctx = ctx

    // Try to get WebGL context for better performance
    try {
      this.gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl")
    } catch (e) {
      console.log("WebGL not available, falling back to 2D canvas")
    }

    this.loadAvatar(config.avatarImage)
    this.setupAudioAnalysis(config.audioContext)
  }

  private async loadAvatar(imageSrc: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        this.avatarImage = img
        this.isInitialized = true
        resolve()
      }
      img.onerror = reject
      img.src = imageSrc
    })
  }

  private setupAudioAnalysis(audioContext?: AudioContext): void {
    if (!audioContext && typeof window !== "undefined" && window.AudioContext) {
      try {
        this.audioContext = new AudioContext()
      } catch (e) {
        console.log("Could not create AudioContext:", e)
        return
      }
    } else if (audioContext) {
      this.audioContext = audioContext
    }

    if (this.audioContext) {
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    }
  }

  public startSpeaking(audioSource?: MediaStreamAudioSourceNode): void {
    this.isSpeaking = true
    this.speechStartTime = Date.now()

    // Connect audio source for real-time lip sync
    if (audioSource && this.analyser) {
      audioSource.connect(this.analyser)
    }

    if (!this.animationFrame) {
      this.animate()
    }
  }

  public stopSpeaking(): void {
    this.isSpeaking = false
  }

  public startAnimation(): void {
    if (!this.animationFrame) {
      this.animate()
    }
  }

  public stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  private animate = (): void => {
    if (!this.isInitialized || !this.avatarImage) {
      this.animationFrame = requestAnimationFrame(this.animate)
      return
    }

    const now = Date.now()
    const deltaTime = now - (this.lastBlinkTime || now)

    // Update animation phases
    this.breathingPhase += 0.016 * this.params.breathing.frequency
    this.headMovementPhase += 0.016 * this.params.headMovement.frequency

    // Analyze audio for lip sync
    this.updateLipSync()

    // Update facial features
    this.updateFacialFeatures(now, deltaTime)

    // Render the avatar
    this.render()

    this.animationFrame = requestAnimationFrame(this.animate)
  }

  private updateLipSync(): void {
    if (!this.analyser || !this.dataArray || !this.isSpeaking) {
      // Gradually close mouth when not speaking
      this.faceFeatures.mouth.openness *= 0.9
      return
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray)

    // Calculate average amplitude in speech frequency range (300Hz - 3400Hz)
    const speechRange = this.dataArray.slice(5, 50) // Approximate speech frequencies
    const average = speechRange.reduce((sum, value) => sum + value, 0) / speechRange.length

    // Normalize and apply sensitivity
    const normalizedAmplitude = (average / 255) * this.params.lipSync.sensitivity

    // Smooth the mouth movement
    const targetOpenness = Math.min(normalizedAmplitude, this.params.lipSync.maxOpenness)
    this.faceFeatures.mouth.openness +=
      (targetOpenness - this.faceFeatures.mouth.openness) * this.params.lipSync.smoothing

    // Add some randomness for natural speech
    if (this.isSpeaking) {
      const speechDuration = Date.now() - this.speechStartTime
      const speechVariation = Math.sin(speechDuration * 0.01) * 0.1 + Math.random() * 0.05
      this.faceFeatures.mouth.openness = Math.max(0, this.faceFeatures.mouth.openness + speechVariation)
    }
  }

  private updateFacialFeatures(now: number, deltaTime: number): void {
    // Breathing animation
    const breathingOffset = Math.sin(this.breathingPhase) * this.params.breathing.amplitude

    // Head movement during speech
    if (this.isSpeaking) {
      this.faceFeatures.head.nod = Math.sin(this.headMovementPhase * 2) * this.params.headMovement.nodAmplitude
      this.faceFeatures.head.rotation =
        Math.sin(this.headMovementPhase) * this.params.headMovement.swayAmplitude + breathingOffset
      this.faceFeatures.head.tilt = Math.cos(this.headMovementPhase * 1.5) * this.params.headMovement.tiltAmplitude
    } else {
      // Subtle idle movements
      this.faceFeatures.head.nod = breathingOffset * 0.5
      this.faceFeatures.head.rotation = Math.sin(this.headMovementPhase * 0.3) * this.params.headMovement.swayAmplitude
      this.faceFeatures.head.tilt = 0
    }

    // Blinking animation
    const timeSinceLastBlink = now - this.lastBlinkTime
    const blinkInterval = this.params.blinking.frequency + Math.random() * this.params.blinking.randomness

    if (timeSinceLastBlink > blinkInterval) {
      this.lastBlinkTime = now
    }

    // Calculate blink factor
    const blinkProgress = Math.min(timeSinceLastBlink / this.params.blinking.duration, 1)
    const blinkFactor = blinkProgress < 1 ? Math.sin(blinkProgress * Math.PI) : 0

    this.faceFeatures.eyes.left.blink = blinkFactor
    this.faceFeatures.eyes.right.blink = blinkFactor
  }

  private render(): void {
    if (!this.avatarImage) return

    const { width, height } = this.canvas
    const dpr = window.devicePixelRatio || 1

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height)

    // Save context
    this.ctx.save()

    // Apply head transformations
    const centerX = width / 2
    const centerY = height / 2

    this.ctx.translate(centerX, centerY)
    this.ctx.rotate(this.faceFeatures.head.rotation)
    this.ctx.scale(1, 1 + this.faceFeatures.head.nod)
    this.ctx.translate(-centerX, -centerY + this.faceFeatures.head.tilt * height)

    // Draw avatar image
    const aspectRatio = this.avatarImage.width / this.avatarImage.height
    const canvasAspectRatio = width / height

    let drawWidth, drawHeight, drawX, drawY

    if (aspectRatio > canvasAspectRatio) {
      drawHeight = height
      drawWidth = height * aspectRatio
      drawX = (width - drawWidth) / 2
      drawY = 0
    } else {
      drawWidth = width
      drawHeight = width / aspectRatio
      drawX = 0
      drawY = (height - drawHeight) / 2
    }

    this.ctx.drawImage(this.avatarImage, drawX, drawY, drawWidth, drawHeight)

    // Draw mouth overlay
    if (this.faceFeatures.mouth.openness > 0.05) {
      this.drawMouth(drawX, drawY, drawWidth, drawHeight)
    }

    // Draw eye blinks
    if (this.faceFeatures.eyes.left.blink > 0.1 || this.faceFeatures.eyes.right.blink > 0.1) {
      this.drawEyeBlinks(drawX, drawY, drawWidth, drawHeight)
    }

    // Restore context
    this.ctx.restore()
  }

  private drawMouth(x: number, y: number, w: number, h: number): void {
    const mouth = this.faceFeatures.mouth
    const mouthX = x + w * mouth.x
    const mouthY = y + h * mouth.y
    const mouthWidth = w * mouth.width * (1 + mouth.openness)
    const mouthHeight = h * mouth.height * mouth.openness

    this.ctx.save()
    this.ctx.globalAlpha = Math.min(mouth.openness * 2, 0.8)
    this.ctx.fillStyle = "#1a0f0a"

    this.ctx.beginPath()
    this.ctx.ellipse(mouthX, mouthY, mouthWidth, mouthHeight, 0, 0, 2 * Math.PI)
    this.ctx.fill()

    // Add inner mouth details
    if (mouth.openness > 0.3) {
      this.ctx.fillStyle = "#4a0f0a"
      this.ctx.beginPath()
      this.ctx.ellipse(mouthX, mouthY + mouthHeight * 0.3, mouthWidth * 0.7, mouthHeight * 0.5, 0, 0, 2 * Math.PI)
      this.ctx.fill()
    }

    this.ctx.restore()
  }

  private drawEyeBlinks(x: number, y: number, w: number, h: number): void {
    const { left, right } = this.faceFeatures.eyes

    this.ctx.save()
    this.ctx.fillStyle = "#d4a574" // Skin tone

    // Left eye
    if (left.blink > 0.1) {
      this.ctx.globalAlpha = left.blink * 0.9
      const leftEyeX = x + w * left.x
      const leftEyeY = y + h * left.y
      this.ctx.beginPath()
      this.ctx.ellipse(leftEyeX, leftEyeY, w * 0.04, h * 0.015, 0, 0, 2 * Math.PI)
      this.ctx.fill()
    }

    // Right eye
    if (right.blink > 0.1) {
      this.ctx.globalAlpha = right.blink * 0.9
      const rightEyeX = x + w * right.x
      const rightEyeY = y + h * right.y
      this.ctx.beginPath()
      this.ctx.ellipse(rightEyeX, rightEyeY, w * 0.04, h * 0.015, 0, 0, 2 * Math.PI)
      this.ctx.fill()
    }

    this.ctx.restore()
  }

  public updateSensitivity(sensitivity: number): void {
    this.params.lipSync.sensitivity = Math.max(0.1, Math.min(2.0, sensitivity))
  }

  public destroy(): void {
    this.stopAnimation()
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close()
    }
  }
}
