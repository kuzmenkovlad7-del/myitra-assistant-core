"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Volume2, Play, Square, AlertCircle, CheckCircle } from "lucide-react"
import { generateGoogleTTS, testDrAlexanderVoice } from "@/lib/google-tts"

export default function TTSTestComponent() {
  const [testText, setTestText] = useState(
    "Вітаю! Я доктор Олександр, ваш психолог. Як ви почуваєтеся сьогодні? Розкажіть мені про те, що вас турбує.",
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  const playTTS = async (gender: "male" | "female") => {
    if (isPlaying) {
      stopAudio()
      return
    }

    if (!testText.trim()) {
      setError("Please enter some text to test")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      console.log(`🎤 Testing Dr. Alexander's ${gender} Ukrainian voice...`)

      const audioDataUrl = await generateGoogleTTS(testText, "uk", gender)

      const audio = new Audio(audioDataUrl)
      setCurrentAudio(audio)
      setIsPlaying(true)

      audio.onended = () => {
        setIsPlaying(false)
        setCurrentAudio(null)
        setSuccess(`✅ Dr. Alexander's ${gender} voice test completed successfully`)
      }

      audio.onerror = (error) => {
        console.error("Audio playback error:", error)
        setError("Failed to play audio")
        setIsPlaying(false)
        setCurrentAudio(null)
      }

      await audio.play()
      setSuccess(`🎤 Playing Dr. Alexander's ${gender} Ukrainian voice...`)
    } catch (error: any) {
      console.error("TTS test error:", error)
      setError(`Failed to generate speech: ${error.message}`)
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }
    setIsPlaying(false)
    setSuccess("")
  }

  const testDefaultVoice = async () => {
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      await testDrAlexanderVoice()
      setSuccess("✅ Dr. Alexander's default voice test completed successfully")
    } catch (error: any) {
      console.error("Default voice test error:", error)
      setError(`Default voice test failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Volume2 className="h-5 w-5" />
          <span>Dr. Alexander's Ukrainian TTS Test</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Text Input */}
        <div>
          <label htmlFor="testText" className="block text-sm font-medium mb-2">
            Ukrainian Test Text:
          </label>
          <Textarea
            id="testText"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Enter Ukrainian text to test Dr. Alexander's voice..."
            className="min-h-[100px]"
          />
        </div>

        {/* Voice Test Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => playTTS("male")}
            disabled={isLoading}
            className="flex items-center space-x-2"
            variant={isPlaying ? "destructive" : "default"}
          >
            {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isPlaying ? "Stop" : "Test Male Voice"} (uk-UA-Chirp3-HD-Schedar)</span>
          </Button>

          <Button
            onClick={() => playTTS("female")}
            disabled={isLoading}
            className="flex items-center space-x-2"
            variant="outline"
          >
            <Play className="h-4 w-4" />
            <span>Test Female Voice (uk-UA-Standard-A)</span>
          </Button>

          <Button
            onClick={testDefaultVoice}
            disabled={isLoading}
            className="flex items-center space-x-2"
            variant="secondary"
          >
            <Volume2 className="h-4 w-4" />
            <span>Test Default Dr. Alexander</span>
          </Button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-green-700 text-sm">{success}</span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-blue-700 text-sm">Generating Dr. Alexander's Ukrainian voice...</span>
          </div>
        )}

        {/* Voice Information */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="font-medium text-sm mb-2">Voice Configuration:</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>
              <strong>Male Voice:</strong> uk-UA-Chirp3-HD-Schedar (Dr. Alexander)
            </li>
            <li>
              <strong>Female Voice:</strong> uk-UA-Standard-A
            </li>
            <li>
              <strong>Language:</strong> Ukrainian (uk-UA)
            </li>
            <li>
              <strong>Speaking Rate:</strong> 0.85 (authoritative)
            </li>
            <li>
              <strong>Pitch:</strong> 0.92 (lower for male)
            </li>
            <li>
              <strong>Accent:</strong> Authentic Ukrainian
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
