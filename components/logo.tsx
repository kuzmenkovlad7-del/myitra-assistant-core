// components/logo.tsx
"use client"

import Image from "next/image"
import { APP_NAME } from "@/lib/app-config"

export default function Logo() {
  return (
    <div className="relative h-9 w-9 sm:h-10 sm:w-10">
      <Image
        src="/logo-turbotaai.svg"
        alt={APP_NAME}
        fill
        priority
        sizes="40px"
      />
    </div>
  )
}
