"use client"

import * as React from "react"
import Image from "next/image"
import BrandMark from "@/components/brand-mark"

export default function AuthLogo({
  className = "h-10 w-10",
  src = "/logo-turbotaai.png",
  alt = "TurbotaAI",
}: {
  className?: string
  src?: string
  alt?: string
}) {
  const [failed, setFailed] = React.useState(false)

  if (failed) return <BrandMark className={className} />

  return (
    <Image
      src={src}
      alt={alt}
      width={48}
      height={48}
      className={className}
      onError={() => setFailed(true)}
      priority
    />
  )
}
