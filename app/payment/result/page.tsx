"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type State = "checking" | "ok" | "fail"

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const orderReference = useMemo(() => {
    const q = String(sp.get("orderReference") || "").trim()
    if (q) return q

    try {
      const a = String(localStorage.getItem("ta_last_order_ref") || "").trim()
      if (a) return a
    } catch {}

    return ""
  }, [sp])

  const [state, setState] = useState<State>("checking")
  const [msg, setMsg] = useState("Проверяем оплату…")
  const [attempt, setAttempt] = useState(1)

  useEffect(() => {
    let alive = true

    async function run() {
      if (!orderReference) {
        setState("fail")
        setMsg("Чек-код не найден. Вернитесь на тарифы и повторите оплату.")
        return
      }

      setState("checking")
      setMsg("Проверяем оплату…")

      for (let i = 0; i < 10; i++) {
        if (!alive) return
        setAttempt(i + 1)

        const r = await fetch("/api/billing/wayforpay/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderReference }),
          cache: "no-store",
          credentials: "include",
        }).catch(() => null)

        const json: any = await r?.json().catch(() => null)

        if (json?.ok) {
          setState("ok")
          setMsg("Оплата подтверждена. Доступ активирован. Перенаправляем в профиль…")

          try {
            window.dispatchEvent(new Event("turbota:refresh"))
          } catch {}

          setTimeout(() => router.replace("/profile"), 700)
          return
        }

        const status = String(json?.status || "")
        setMsg(status ? `Ожидание подтверждения… (${status})` : "Ожидание подтверждения…")
        await new Promise((x) => setTimeout(x, 1200))
      }

      setState("fail")
      setMsg("Оплата пока не подтверждена. Если вы оплатили, нажмите Проверить снова.")
    }

    run()
    return () => {
      alive = false
    }
  }, [orderReference, router])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Результат оплаты</h1>

        <div className="mt-2 text-sm text-gray-600">
          Чек-код: <span className="font-mono text-gray-900">{orderReference || "—"}</span>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
          {msg}
          {state === "checking" ? (
            <div className="mt-2 text-xs text-gray-500">Попытка: {attempt}/10</div>
          ) : null}
        </div>

        {state === "fail" ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="flex-1 rounded-xl bg-black px-4 py-2 text-white"
            >
              Проверить снова
            </button>
            <button onClick={() => router.replace("/pricing")} className="flex-1 rounded-xl border px-4 py-2">
              Тарифы
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
