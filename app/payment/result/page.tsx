"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type StatusResp = {
  ok?: boolean
  status?: string
  state?: string
  orderStatus?: string
  transactionStatus?: string | null
  access?: string | null
  paid_until?: string | null
  promo_until?: string | null
  errorCode?: string
  message?: string
}

function normalizeStatus(d: any): "approved" | "pending" | "failed" | "unknown" {
  const s = String(d?.status || d?.state || d?.orderStatus || "").toLowerCase()
  if (!s) return "unknown"

  // paid
  if (["approved", "success", "paid", "ok", "completed"].some((x) => s.includes(x))) return "approved"

  // pending variants
  if (["pending", "processing", "inprocessing", "wait"].some((x) => s.includes(x))) return "pending"
  if (["created", "invoice_created", "invoice"].some((x) => s.includes(x))) return "pending"

  // failed
  if (["declined", "failed", "error", "rejected", "canceled", "cancelled", "refunded", "expired"].some((x) => s.includes(x))) {
    return "failed"
  }

  return "unknown"
}

export default function PaymentResultPage() {
  const sp = useSearchParams()
  const router = useRouter()

  const orderReference = sp.get("orderReference") || sp.get("order_reference") || ""
  const [status, setStatus] = useState<"idle" | "pending" | "approved" | "failed" | "unknown">("idle")
  const [details, setDetails] = useState<StatusResp | null>(null)
  const [attempt, setAttempt] = useState(0)

  const title = useMemo(() => {
    if (status === "approved") return "Оплата успішна"
    if (status === "failed") return "Оплата не пройшла"
    if (status === "pending") return "Перевіряємо оплату..."
    return "Результат оплати"
  }, [status])

  const desc = useMemo(() => {
    if (!orderReference) return "Немає номера замовлення. Поверніться на підписку та спробуйте ще раз."
    if (status === "approved") return "Доступ оновлено. Переходимо до керування підпискою."
    if (status === "failed") return "Оплата не підтвердилася. Спробуйте ще раз."
    if (status === "pending") return "Зазвичай це займає декілька секунд."
    return "Очікуємо підтвердження."
  }, [status, orderReference])

  const fetchStatus = useCallback(async () => {
    if (!orderReference) {
      setStatus("failed")
      setDetails({ ok: false, errorCode: "NO_ORDER_REFERENCE" })
      return
    }

    try {
      const r = await fetch(`/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      })

      const data = (await r.json().catch(() => ({} as any))) as StatusResp
      setDetails(data)

      const st = normalizeStatus(data)
      setStatus(st)
    } catch {
      setStatus("pending")
      setDetails({ ok: false, errorCode: "NETWORK" })
    }
  }, [orderReference])

  useEffect(() => {
    setStatus("pending")
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (status !== "approved") return
    const t = setTimeout(() => {
      router.replace("/subscription?paid=1")
    }, 700)
    return () => clearTimeout(t)
  }, [status, router])

  useEffect(() => {
    if (status !== "pending") return
    if (attempt >= 20) return
    const t = setTimeout(() => {
      setAttempt((a) => a + 1)
      fetchStatus()
    }, 2000)
    return () => clearTimeout(t)
  }, [status, attempt, fetchStatus])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-10">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-sm text-slate-700">
          {orderReference ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Order</span>
                <span className="font-mono text-xs">{orderReference}</span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-medium">{status}</span>
              </div>

              {details?.status ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-slate-500">Raw</span>
                  <span className="font-medium">{String(details.status)}</span>
                </div>
              ) : null}

              {details?.transactionStatus ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-slate-500">Tx</span>
                  <span className="font-medium">{String(details.transactionStatus)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full border border-slate-200" onClick={fetchStatus}>
              Оновити статус
            </Button>

            <Button className="rounded-full" onClick={() => window.location.assign("/subscription")}>
              Перейти до підписки
            </Button>

            <Button variant="ghost" className="rounded-full" onClick={() => window.location.assign("/pricing")}>
              Тарифи
            </Button>
          </div>

          {details?.errorCode ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              {String(details.errorCode)}
            </div>
          ) : null}

          <div className="text-xs text-slate-500">
            Якщо статус довго не оновлюється, відкрийте Підписку і перевірте доступ у Профілі.
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
