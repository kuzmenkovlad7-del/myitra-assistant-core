"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Summary = {
  ok?: boolean
  access?: string
  paidUntil?: string | null
  promoUntil?: string | null
}

export default function PaymentReturnPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "waiting" | "ok" | "error">("checking")

  useEffect(() => {
    let alive = true

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const check = async () => {
      try {
        for (let i = 0; i < 16; i++) {
          const r = await fetch("/api/account/summary", { cache: "no-store" })
          const j = (await r.json().catch(() => ({}))) as Summary
          const access = String(j.access || "").toLowerCase()

          if (access === "active") {
            setStatus("ok")
            await sleep(600)
            if (alive) router.replace("/profile")
            return
          }

          setStatus("waiting")
          await sleep(1500)
        }

        if (alive) router.replace("/pricing")
      } catch {
        if (!alive) return
        setStatus("error")
        router.replace("/pricing")
      }
    }

    check()
    return () => {
      alive = false
    }
  }, [router])

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Processing payment</h1>
      <p className="mt-3 text-muted-foreground">
        Please wait. We are confirming your payment and activating access.
      </p>

      <div className="mt-8 rounded-xl border p-4">
        <div className="text-sm">
          Status:{" "}
          {status === "checking" && "Checking..."}
          {status === "waiting" && "Waiting for confirmation..."}
          {status === "ok" && "Activated. Redirecting..."}
          {status === "error" && "Error. Redirecting..."}
        </div>
      </div>
    </main>
  )
}
