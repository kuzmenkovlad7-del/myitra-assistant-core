"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentReturnPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const orderReference = sp.get("orderReference")

  useEffect(() => {
    const t = setTimeout(() => {
      router.push("/subscription")
      router.refresh()
    }, 1200)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Card className="rounded-2xl border border-slate-200">
        <CardHeader>
          <CardTitle className="text-2xl">Payment processing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          <div>Your payment is being confirmed. Your access will be updated automatically.</div>
          {orderReference ? (
            <div className="mt-2 text-xs text-slate-500">Order: {orderReference}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
