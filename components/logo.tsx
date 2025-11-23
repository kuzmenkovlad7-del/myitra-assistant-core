"use client"

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { Brain } from 'lucide-react'

const pulseKeyframes = keyframes`
  0% {
    transform: scale(0.97);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.03);
    opacity: 1;
  }
  100% {
    transform: scale(0.97);
    opacity: 0.8;
  }
`

const glowKeyframes = keyframes`
  0% {
    opacity: 0.1;
    box-shadow: 0 0 0 0 rgba(2, 90, 160, 0.1);
  }
  50% {
    opacity: 0.4;
    box-shadow: 0 0 8px 3px rgba(2, 90, 160, 0.3);
  }
  100% {
    opacity: 0.1;
    box-shadow: 0 0 0 0 rgba(2, 90, 160, 0.1);
  }
`

const brainAnimationKeyframes = keyframes`
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-3deg);
  }
  75% {
    transform: rotate(3deg);
  }
  100% {
    transform: rotate(0deg);
  }
`

const AnimatedContainer = styled.div`
  .animate-brain-pulse {
    animation: ${pulseKeyframes} 3s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
  }
  
  .animate-brain-glow {
    animation: ${glowKeyframes} 3s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
  }
  
  .animate-brain {
    animation: ${brainAnimationKeyframes} 4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
  }
`

export default function Logo() {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  return (
    <AnimatedContainer>
      <div
        className="relative flex items-center cursor-pointer"
        onClick={handleReload}
        role="button"
        tabIndex={0}
        aria-label="Reload page"
        title="Click to reload the page"
      >
        <div className="w-10 h-10 mr-2 relative">
          <div className="absolute inset-0 bg-lavender-200 rounded-full animate-brain-pulse">
            <div className="absolute inset-0 rounded-full opacity-0 animate-brain-glow"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary-700 animate-brain" />
          </div>
        </div>
        <span className="text-2xl font-bold text-primary-800">Myitra</span>
      </div>
    </AnimatedContainer>
  )
}
