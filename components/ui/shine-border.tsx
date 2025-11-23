"use client"

import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

type TColorProp = string | string[]

interface ShineBorderProps {
  borderRadius?: number
  borderWidth?: number
  duration?: number
  color?: TColorProp
  className?: string
  children: ReactNode
}

/**
 * ShineBorder — мягкая светящаяся рамка вокруг контента,
 * похожая на пример с 21st.dev, но без лишних зависимостей.
 */
export function ShineBorder({
  borderRadius = 32,
  borderWidth = 2,
  duration = 18,
  color = ["#6366F1", "#8B5CF6", "#22D3EE"],
  className,
  children,
}: ShineBorderProps) {
  const gradientColors = Array.isArray(color) ? color.join(",") : color

  const wrapperStyle: CSSProperties = {
    borderRadius: `${borderRadius}px`,
    padding: `${borderWidth}px`,
    backgroundImage: `linear-gradient(120deg, ${gradientColors})`,
    backgroundSize: "200% 200%",
    animationDuration: `${duration}s`,
  }

  const innerStyle: CSSProperties = {
    borderRadius: `${borderRadius - borderWidth}px`,
  }

  return (
    <div
      style={wrapperStyle}
      className={cn(
        "relative w-full animate-shine-pulse shadow-[0_24px_80px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      <div
        style={innerStyle}
        className="h-full w-full bg-white/95 backdrop-blur-xl"
      >
        {children}
      </div>
    </div>
  )
}
