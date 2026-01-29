"use client"


const PAY_FAIL_PUBLIC_TEXT = "Оплату не підтверджено. Перевірте дані картки, ліміт або спробуйте іншу."
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type StatusResp = {
  ok?: boolean
  found?: boolean
  orderReference?: string
  planId?: string | null
  amount?: number | string | null
  currency?: string | null
  status?: string
  transactionStatus?: string | null
  reason?: string | null
  reasonCode?: number | string | null
  error?: string
  details?: string
}

const MAX_ATTEMPTS = 10
const SLEEP_MS = 2500

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export default function PaymentResultPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderReference = useMemo(() => {
    return (
      searchParams.get("orderReference") ||
      searchParams.get("order_reference") ||
      searchParams.get("order") ||
      ""
    ).trim()
  }, [searchParams])

  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"pending" | "paid" | "failed" | "error">("pending")
  const [details, setDetails] = useState<string | null>(null)

  const checkOnce = useCallback(async () => {
    if (!orderReference) {
      setStatus("error")
      setDetails("Missing orderReference")
      return true
    }

    setAttempt((a) => Math.min(a + 1, MAX_ATTEMPTS))

    try {
      const r = await fetch(
        `/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`,
        { cache: "no-store" }
      )
      const j = (await r.json().catch(() => ({}))) as StatusResp

      if (!r.ok || !j?.ok) {
        setStatus("error")
        setDetails(j?.error || j?.details || "status request failed")
        return false
      }

      const st = String(j?.status || "").toLowerCase()

      if (st === "paid" || st === "approved") {
        setStatus("paid")
        setDetails(null)
        return true
      }

      if (
        st === "failed" ||
        st === "declined" ||
        st === "expired" ||
        st === "refunded" ||
        st === "rejected"
      ) {
        setStatus("failed")
        setDetails(j?.reason ? String(j.reason) : null)
        return true
      }

      setStatus("pending")
      setDetails(null)
      return false
    } catch (e: any) {
      setStatus("error")
      setDetails(String(e?.message || e))
      return false
    }
  }, [orderReference])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return
        const done = await checkOnce()
        if (done) return
        await sleep(SLEEP_MS)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [checkOnce])

  const subtitle = orderReference ? `Чек-код: ${orderReference}` : "Чек-код: —"

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto w-full max-w-xl rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-2xl font-semibold">Результат оплати</div>
        <div className="mt-2 text-sm text-gray-500">{subtitle}</div>

        {status === "paid" ? (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-900">
            Оплату підтверджено. Доступ активовано.
          </div>
        ) : status === "failed" ? (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-900">
            Оплата не пройшла.
            {details ? .<div className="mt-2 text-red-700">."{PAY_FAIL_PUBLIC_TEXT}".</div> : null}
          </div>
        ) : status === "error" ? (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-900">
            Не вдалося перевірити статус.
            {details ? <div className="mt-2 text-red-700">{details}</div> : null}
          </div>
        ) : (
          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-900">
            Оплату поки не підтверджено. Якщо Ви оплатили, зачекайте або натисніть Перевірити знову.
            <div className="mt-2 text-gray-500">Спроба: {Math.min(attempt, MAX_ATTEMPTS)}/{MAX_ATTEMPTS}</div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {status === "paid" ? (
            <button
              className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              onClick={() => router.push("/profile?paid=1")}
            >
              Перейти в профіль
            </button>
          ) : (
            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              onClick={() => {
                setAttempt(0)
                setStatus("pending")
                setDetails(null)
                checkOnce()
              }}
            >
              Перевірити знову
            </button>
          )}

          <button
            className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => router.push("/pricing")}
          >
            Тарифи
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Порада: щоб не втратити доступ при очищенні cookie, увійдіть або зареєструйтеся і прив’яжіть доступ до акаунта.
        </div>
      </div>
    </div>
  )
}
