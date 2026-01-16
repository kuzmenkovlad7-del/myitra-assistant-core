"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import BrandMark from "@/components/brand-mark"

export interface CursorWanderCardProps {
  cardholderName?: string
  className?: string
  theme?: {
    primaryColor?: string
    secondaryColor?: string
    glowColor?: string
  }
  logoText?: {
    topText?: string
    bottomText?: string
  }
  logoSrc?: string
  logoAlt?: string
  height?: string | number
  width?: string | number
}

const CARD_CSS = `
@keyframes holographicShift {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
  100% { background-position: 0% 0%; }
}

@keyframes pulse-glow {
  0% { filter: blur(5px) brightness(1); }
  50% { filter: blur(7px) brightness(1.25); }
  100% { filter: blur(5px) brightness(1); }
}

@keyframes twinkle {
  0% { opacity: 0.1; }
  50% { opacity: 0.7; }
  100% { opacity: 0.3; }
}

@keyframes particles-float {
  0% { background-position: 0% 0%; }
  50% { background-position: 75% 75%; }
  100% { background-position: 0% 0%; }
}

.animate-holographicShift { animation: holographicShift 5s ease infinite; }
.animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }

.stars-small, .stars-medium, .stars-large, .stars-twinkle {
  position: absolute;
  width: 100%;
  height: 100%;
}

.stars-small {
  background-image:
    radial-gradient(1px 1px at 20px 30px, white, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 40px 70px, white, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 50px 160px, white, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 90px 40px, white, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 130px 80px, white, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 160px 120px, white, rgba(0,0,0,0));
  background-size: 200px 200px;
  opacity: 0.35;
}

.stars-medium {
  background-image:
    radial-gradient(1.5px 1.5px at 150px 150px, white, rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 220px 220px, white, rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 80px 250px, white, rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 180px 80px, white, rgba(0,0,0,0));
  background-size: 300px 300px;
  opacity: 0.35;
}

.stars-large {
  background-image:
    radial-gradient(2px 2px at 100px 100px, white, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 200px 200px, white, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 300px 300px, white, rgba(0,0,0,0));
  background-size: 400px 400px;
  opacity: 0.4;
}

.stars-twinkle {
  background-image:
    radial-gradient(2px 2px at 50px 50px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
    radial-gradient(2px 2px at 150px 150px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
    radial-gradient(2px 2px at 250px 250px, rgba(255,255,255,0.8), rgba(0,0,0,0));
  background-size: 300px 300px;
  opacity: 0;
  animation: twinkle 4s ease-in-out infinite alternate;
}

.particles-container {
  position: absolute;
  width: 100%;
  height: 100%;
  background-image:
    radial-gradient(1px 1px at 10% 10%, rgba(255,255,255,0.8), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 20% 20%, rgba(51,195,240,0.7), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 35% 35%, rgba(255,255,255,0.8), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 50% 50%, rgba(51,195,240,0.7), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 70% 70%, rgba(51,195,240,0.7), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 90% 90%, rgba(255,255,255,0.8), rgba(0,0,0,0));
  background-size: 150% 150%;
  animation: particles-float 20s ease infinite;
  opacity: 0.55;
}
`

export default function CursorWanderCard({
  cardholderName = "CARDHOLDER NAME",
  className = "",
  theme = {
    primaryColor: "#0FA0CE",
    secondaryColor: "#0056b3",
    glowColor: "rgba(15, 160, 206, 0.75)",
  },
  logoText = { topText: "TurbotaAI", bottomText: "MONTHLY" },
  logoSrc = "/logo-turbotaai.png",
  logoAlt = "TurbotaAI",
  height = "280px",
  width = "100%",
}: CursorWanderCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [time, setTime] = useState(0)
  const [logoFailed, setLogoFailed] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const timeAnimationRef = useRef<number>(0)

  const rotationRef = useRef({ x: 12, y: 16, z: 4 })
  const rotationSpeedRef = useRef({ x: 0.18, y: 0.22, z: 0.05 })

  const animate = () => {
    if (!cardRef.current || isHovered) return

    rotationRef.current.x += rotationSpeedRef.current.x
    rotationRef.current.y += rotationSpeedRef.current.y
    rotationRef.current.z += rotationSpeedRef.current.z

    if (Math.abs(rotationRef.current.x) > 12) rotationSpeedRef.current.x *= -1
    if (Math.abs(rotationRef.current.y) > 12) rotationSpeedRef.current.y *= -1
    if (Math.abs(rotationRef.current.z) > 4) rotationSpeedRef.current.z *= -1

    cardRef.current.style.transform = `
      rotateX(${rotationRef.current.x}deg)
      rotateY(${rotationRef.current.y}deg)
      rotateZ(${rotationRef.current.z}deg)
    `

    animationRef.current = requestAnimationFrame(animate)
  }

  const animateTime = () => {
    setTime((prev) => prev + 0.01)
    timeAnimationRef.current = requestAnimationFrame(animateTime)
  }

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const angleX = ((e.clientY - centerY) / (rect.height / 2)) * 45
      const angleY = (-(e.clientX - centerX) / (rect.width / 2)) * 45

      card.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg) rotateZ(${Math.min(Math.abs(angleX) + Math.abs(angleY), 18) / 10}deg)`
    }

    const handleMouseEnter = () => {
      setIsHovered(true)
      cancelAnimationFrame(animationRef.current)
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    timeAnimationRef.current = requestAnimationFrame(animateTime)

    card.addEventListener("mouseenter", handleMouseEnter)
    card.addEventListener("mousemove", handleMouseMove)
    card.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      cancelAnimationFrame(animationRef.current)
      cancelAnimationFrame(timeAnimationRef.current)
      card.removeEventListener("mouseenter", handleMouseEnter)
      card.removeEventListener("mousemove", handleMouseMove)
      card.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [isHovered])

  return (
    <div className={`perspective-3000 ${className}`} style={{ perspective: "3000px" }}>
      <div
        ref={cardRef}
        className="relative transition-transform hover:scale-[1.03]"
        style={{
          transition: "transform 0.1s ease-out",
          transformStyle: "preserve-3d",
          width,
          height,
        }}
      >
        <div
          className="absolute h-full w-full overflow-hidden rounded-3xl shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #001a33 0%, #003366 50%, #0056b3 100%)",
            boxShadow: `0 25px 50px -12px ${theme.glowColor}`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at ${50 + Math.sin(time * 0.5) * 30}% ${50 + Math.cos(time * 0.7) * 30}%, ${theme.glowColor} 0%, transparent 70%),
                radial-gradient(circle at ${50 + Math.cos(time * 0.3) * 40}% ${50 + Math.sin(time * 0.4) * 40}%, rgba(128, 0, 255, 0.35) 0%, transparent 60%),
                radial-gradient(circle at ${50 + Math.sin(time * 0.6) * 35}% ${50 + Math.cos(time * 0.5) * 35}%, rgba(255, 128, 240, 0.25) 0%, transparent 55%)
              `,
              opacity: 0.9,
            }}
          />

          <div
            className="absolute inset-0 animate-holographicShift"
            style={{
              background:
                "linear-gradient(45deg, transparent 40%, rgba(51, 195, 240, 0.12) 45%, rgba(51, 195, 240, 0.24) 50%, rgba(51, 195, 240, 0.12) 55%, transparent 60%)",
              backgroundSize: "200% 200%",
            }}
          />

          <div className="absolute inset-0 overflow-hidden">
            <div className="stars-small"></div>
            <div className="stars-medium"></div>
            <div className="stars-large"></div>
            <div className="stars-twinkle"></div>
          </div>

          <div className="absolute inset-0 overflow-hidden">
            <div className="particles-container"></div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative h-32 w-32 md:h-40 md:w-40">
              <div
                className="absolute h-full w-full animate-pulse-glow"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  clipPath: "polygon(40% 0%, 60% 0%, 100% 40%, 100% 60%, 60% 100%, 40% 100%, 0% 60%, 0% 40%)",
                  transform: "rotate(45deg)",
                  opacity: 0.7,
                  filter: "blur(5px)",
                  boxShadow: `0 0 28px ${theme.glowColor}`,
                }}
              />
            </div>
          </div>

          <div className="absolute left-4 top-4 flex items-center gap-2 sm:left-6 sm:top-6">
            <div className="relative h-6 w-6">
              {logoFailed ? (
                <div className="text-white/90">
                  <BrandMark className="h-6 w-6" />
                </div>
              ) : (
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  fill
                  className="object-contain opacity-90"
                  onError={() => setLogoFailed(true)}
                  priority
                />
              )}
            </div>

            <div className="flex flex-col text-xs font-semibold text-white/90">
              <span className="tracking-wide">{logoText.topText}</span>
              <span className="tracking-wide">{logoText.bottomText}</span>
            </div>
          </div>

          <div className="absolute left-4 top-16 sm:left-6 sm:top-24">
            <div
              className="h-10 w-14 rounded-md opacity-90"
              style={{
                boxShadow: "0 2px 4px rgba(0,0,0,0.2), 0 0 10px rgba(51, 195, 240, 0.3)",
                background: "linear-gradient(135deg, #d4d4d4 0%, #a0a0a0 50%, #d4d4d4 100%)",
              }}
            />
          </div>

          <div className="absolute bottom-4 left-0 w-full px-4 sm:bottom-6 sm:px-6">
            <div className="text-xs tracking-wider text-white/80 sm:text-sm" style={{ textShadow: "0 0 5px rgba(51, 195, 240, 0.5)" }}>
              {cardholderName}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CARD_CSS }} />
    </div>
  )
}
