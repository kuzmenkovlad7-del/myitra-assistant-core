"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function PaymentReturnPage() {
  const sp = useSearchParams()
  const router = useRouter()

  const orderReference = sp.get("orderReference") || sp.get("order_reference") || ""

  useEffect(() => {
    if (orderReference) {
      router.replace(`/payment/result?orderReference=${encodeURIComponent(orderReference)}`)
      return
    }
    router.replace("/subscription")
  }, [orderReference, router])

  return null
}
