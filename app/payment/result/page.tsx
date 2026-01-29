"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

type OrderStatus = "pending" | "paid" | "failed"

type StatusResp = {
  ok?: boolean
  status?: string
  order?: { status?: string }
  transactionStatus?: string | null
  reason?: string | null
  details?: string | null
}

const PAY_FAIL_PUBLIC_TEXT = "Оплату не підтверджено. Перевірте дані картки, ліміт або спробуйте іншу."
const MAX_TRIES = 10
const RETRY_MS = 2500

function normalizeStatus(v: any): OrderStatus {
  const s = String(v || "").toLowerCase()
  if (s === "paid" || s === "approved" || s === "success") return "paid"
  if (s === "failed" || s === "declined" || s === "expired" || s === "canceled" || s === "cancelled") return "failed"
  return "pending"
}

async function fetchStatus(orderReference: string): Promise<{ st: OrderStatus; details: string | null }> {
  const r = await fetch(`/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`, {
    method: "GET",
    cache: "no-store",
  })
  const j: StatusResp = await r.json().catch(() => ({} as any))

  const st = normalizeStatus((j as any)?.status ?? (j as any)?.order?.status)
  const d = (j as any)?.reason ?? (j as any)?.transactionStatus ?? (j as any)?.details ?? null
  return { st, details: d ? String(d) : null }
}

export default function PaymentResultPage() {
  const sp = useSearchParams()
  const orderReference = (sp.get("orderReference") || "").trim()
  const debug = sp.get("debug") === "1"

  const [status, setStatus] = useState<OrderStatus>("pending")
  const [details, setDetails] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [loading, setLoading] = useState(false)

  const timerRef = useRef<any>(null)

  const subtitle = orderReference ? `Чек-код: ${orderReference}` : "Чек-код: —"

  const checkOnce = async () => {
    if (!orderReference) return
    setLoading(true)
    try {
      const res = await fetchStatus(orderReference)
      setStatus(res.st)
      setDetails(res.details)
    } catch (e: any) {
      setStatus("pending")
      setDetails(String(e?.message || e) || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTries(0)
    setStatus("pending")
    setDetails(null)

    if (!orderReference) return

    let cancelled = false

    const loop = async (n: number) => {
      if (cancelled) return
      setTries(n)
      try {
        const res = await fetchStatus(orderReference)
        if (cancelled) return
        setStatus(res.st)
        setDetails(res.details)

        if (res.st === "pending" && n < MAX_TRIES) {
          timerRef.current = setTimeout(() => loop(n + 1), RETRY_MS)
        }
      } catch (e: any) {
        if (cancelled) return
        setStatus("pending")
        setDetails(String(e?.message || e) || null)
        if (n < MAX_TRIES) timerRef.current = setTimeout(() => loop(n + 1), RETRY_MS)
      }
    }

    loop(1)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderReference])

  const showPaid = status === "paid"
  const showFailed = status === "failed"
  const showPending = status === "pending"

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto w-full max-w-xl rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-2xl font-semibold">Результат оплати</div>
        <div className="mt-2 text-sm text-gray-500">{subtitle}</div>

        {showPaid ? (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-900">
            Оплату підтверджено. Доступ активовано.
          </div>
        ) : null}

        {showPending ? (
          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-900">
            Оплату поки не підтверджено. Якщо Ви оплатили, зачекайте або натисніть Перевірити знову.
            <div className="mt-2 text-xs text-gray-500">
              Спроба: {tries}/{MAX_TRIES}
            </div>
          </div>
        ) : null}

        {showFailed ? (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-900">
            Оплата не пройшла.
            <div className="mt-2 text-red-700">{PAY_FAIL_PUBLIC_TEXT}</div>
            {debug && details ? <div className="mt-2 text-xs text-red-700">Debug: {details}</div> : null}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {showPaid ? (
            <button
              className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
              onClick={() => window.location.assign("/profile")}
            >
              Перейти в профіль
            </button>
          ) : (
            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium"
              disabled={loading || !orderReference}
              onClick={async () => {
                if (timerRef.current) clearTimeout(timerRef.current)
                await checkOnce()
              }}
            >
              {loading ? "Перевіряємо..." : "Перевірити знову"}
            </button>
          )}

          <button
            className="w-full rounded-xl border px-4 py-2 text-sm font-medium"
            onClick={() => window.location.assign("/pricing")}
          >
            Тарифи
          </button>
        </div>

        {showPaid ? (
          <div className="mt-6 text-xs text-gray-500">
            Порада: щоб не втратити доступ при очищенні cookie, увійдіть або зареєструйтесь і привʼяжіть доступ до аккаунта.
          </div>
        ) : null}
      </div>
    </div>
  )
}
