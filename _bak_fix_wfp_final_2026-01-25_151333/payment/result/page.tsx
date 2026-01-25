"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type SyncResp = {
  ok?: boolean
  status?: string
  message?: string
}

async function trySync(orderReference: string): Promise<SyncResp> {
  const url = `/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`

  // 1) пробуем GET
  let r = await fetch(url, { method: "GET", cache: "no-store" }).catch(() => null)

  // 2) если sync у тебя сделан POST-ом
  if (!r || r.status === 405) {
    r = await fetch("/api/billing/wayforpay/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderReference }),
      cache: "no-store",
    }).catch(() => null)
  }

  const json = (await r?.json().catch(() => null)) as SyncResp | null
  return json ?? { ok: false, message: "Нет ответа от sync" }
}

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const orderReference = useMemo(() => {
    const v = sp.get("orderReference")
    return (v ?? "").trim()
  }, [sp])

  const [state, setState] = useState<"idle" | "checking" | "ok" | "fail">("idle")
  const [msg, setMsg] = useState<string>("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true

    async function run() {
      if (!orderReference) {
        setState("fail")
        setMsg("Не найден чек-код orderReference. Вернитесь на страницу тарифов и нажмите подписаться снова.")
        return
      }

      setState("checking")
      setMsg("Проверяем оплату...")

      // делаем несколько попыток, потому что webhook может прийти чуть позже
      for (let i = 0; i < 8; i++) {
        if (!alive) return

        const res = await trySync(orderReference)

        if (res?.ok) {
          setState("ok")
          setMsg("Оплата подтверждена. Открываю профиль...")
          setTimeout(() => {
            router.replace("/profile?paid=1")
          }, 600)
          return
        }

        setAttempt(i + 1)
        setMsg(res?.message || `Ожидание подтверждения... (${i + 1}/8)`)
        await new Promise((r) => setTimeout(r, 1200))
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
            <div className="mt-2 text-xs text-gray-500">Попытка: {attempt}/8</div>
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
            <button
              onClick={() => router.replace("/pricing")}
              className="flex-1 rounded-xl border px-4 py-2"
            >
              Тарифы
            </button>
          </div>
        ) : null}

        <div className="mt-4 text-xs text-gray-500">
          Если вы удалили cookie или меняли устройство, восстановление делается этим же чек-кодом через страницу тарифов.
        </div>
      </div>
    </div>
  )
}
