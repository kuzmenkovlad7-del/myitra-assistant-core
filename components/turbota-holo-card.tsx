"use client"

import * as React from "react"
import CursorWanderCard from "@/components/ui/cursor-wander-card"

type CursorProps = React.ComponentProps<typeof CursorWanderCard>

type TurbotaHoloCardProps = CursorProps & {
  title?: string
  subtitle?: string
}

export default function TurbotaHoloCard(props: TurbotaHoloCardProps) {
  const {
    title,
    subtitle,
    cardholderName,
    logoText,
    height,
    width,
    ...rest
  } = props

  const resolvedLogoText =
    logoText ??
    (title
      ? { topText: title, bottomText: "" }
      : { topText: "TurbotaAI", bottomText: "MONTHLY" })

  const resolvedCardholderName = cardholderName ?? subtitle ?? "TurbotaAI Monthly"

  return (
    <CursorWanderCard
      cardholderName={resolvedCardholderName}
      logoText={resolvedLogoText}
      height={height ?? 320}
      width={width ?? "100%"}
      {...rest}
    />
  )
}
