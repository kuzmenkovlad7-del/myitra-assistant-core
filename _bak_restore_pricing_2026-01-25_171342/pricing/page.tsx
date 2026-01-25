"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

type SummaryLike = {
  logged_in?: boolean
  email?: string | null
  trial_questions_left?: number | null
  paid_until?: string | null
  promo_until?: string | null
  access?: string | null
}

function isActive(iso?: string | null) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t > Date.now()
}

function getCookie(name: string) {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return m ? decodeURIComponent(m[2]) : ""
}

export default function PricingPage() {
  const sp = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SummaryLike | null>(null)

  const [syncLoading, setSyncLoading] = useState(false)
  const [restoreCode, setRestoreCode] = useState("")
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)

  const payError = sp.get("pay") === "error"

  const access = useMemo(() => {
    if (!summary) return "Limited"
    if (summary.access) return summary.access
    if (isActive(summary.paid_until)) return "Paid"
    if (isActive(summary.promo_until)) return "Promo"
    return "Limited"
  }, [summary])

  const trialLeft = useMemo(() => {
    const v = Number(summary?.trial_questions_left ?? 5)
    return Number.isFinite(v) ? v : 5
  }, [summary])

  async function loadSummary() {
    setLoading(true)
    try {
      const r = await fetch("/api/account/summary", { cache: "no-store" })
      const j: any = await r.json().catch(() => null)
      const s: SummaryLike = {
        logged_in: !!(j?.logged_in ?? j?.user?.id),
        email: j?.email ?? j?.user?.email ?? null,
        trial_questions_left: j?.trial_questions_left ?? j?.grant?.trial_questions_left ?? 5,
        paid_until: j?.paid_until ?? j?.grant?.paid_until ?? null,
        promo_until: j?.promo_until ?? j?.grant?.promo_until ?? null,
        access: j?.access ?? null,
      }
      setSummary(s)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncOrder(orderReference: string) {
    const code = String(orderReference || "").trim()
    if (!code) return

    setSyncLoading(true)
    setRestoreMsg(null)
    try {
      const r = await fetch("/api/billing/wayforpay/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderReference: code }),
        cache: "no-store",
      })
      const j: any = await r.json().catch(() => null)

      if (j?.ok) {
        // закрепляем чек-код на устройстве
        document.cookie = `ta_last_order=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
        setRestoreMsg("Готово. Доступ обновлён на этом устройстве ✅")
        await loadSummary()
      } else {
        setRestoreMsg(j?.message || `Не подтверждено. Статус: ${j?.status || "—"}`)
      }
    } catch (e: any) {
      setRestoreMsg(String(e?.message || e))
    } finally {
      setSyncLoading(false)
    }
  }

  function onSubscribe() {
    // ✅ ВАЖНО: никаких window.open -> только редирект в той же вкладке
    window.location.assign("/api/billing/wayforpay/purchase?planId=monthly")
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <div className="text-5xl font-semibold tracking-tight">Тарифы</div>
        <div className="mt-2 text-gray-600">
          Безлимитный доступ к чату, голосу и видео. Пробный режим включает 5 вопросов.
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT - PLAN CARD */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-2xl font-semibold">Ежемесячно</div>
          <div className="mt-1 text-gray-600">Безлимитный доступ к чату, голосу и видео</div>

          <div className="mt-6 flex items-end gap-3">
            <div className="text-6xl font-semibold leading-none">₴</div>
            <div className="pb-2 text-lg text-gray-600">UAH</div>
          </div>

          <ul className="mt-4 space-y-2 text-gray-700">
            <li>• Безлимитное количество запросов</li>
            <li>• Чат, голос и видео</li>
            <li>• История сохраняется в профиле</li>
          </ul>

          {/* 3D CARD (без зависимостей от картинок) */}
          <div className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-700 shadow-lg">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-white/40 blur-2xl" />
              <div className="absolute right-10 top-10 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
              <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-black/20 blur-2xl" />
            </div>

            <div className="relative p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-white/90" />
                  <div className="text-sm font-medium text-white/90">TurbotaAI</div>
                </div>
                <div className="h-10 w-14 rounded-xl bg-white/30 shadow-inner" />
              </div>

              <div className="mt-8 h-24 w-36 rounded-2xl bg-white/20 shadow-inner" />

              <div className="mt-10 text-sm text-white/80">TurbotaAI Monthly</div>
            </div>
          </div>

          <button
            onClick={onSubscribe}
            disabled={access === "Paid"}
            className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-medium transition ${
              access === "Paid"
                ? "cursor-not-allowed bg-gray-200 text-gray-500"
                : "bg-black text-white hover:opacity-90"
            }`}
          >
            {access === "Paid" ? "Подписка активна" : "Подписаться"}
          </button>

          <div className="mt-2 text-xs text-gray-500">
            {summary?.logged_in
              ? "После оплаты доступ продлится на 30 дней."
              : "Покупка доступна без входа. Доступ закрепляется за устройством, а восстановление возможно по чек-коду."}
          </div>

          {payError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Не удалось создать оплату. Проверьте переменные WayForPay и домен мерчанта.
            </div>
          ) : null}

          {/* RESTORE BY CHECK-CODE */}
          <div className="mt-6 rounded-2xl border bg-gray-50 p-4">
            <div className="text-sm font-medium">Восстановить доступ по чек-коду</div>
            <div className="mt-2 flex gap-2">
              <input
                value={restoreCode}
                onChange={(e) => setRestoreCode(e.target.value)}
                placeholder="Вставьте чек-код оплаты"
                className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={() => syncOrder(restoreCode)}
                disabled={syncLoading || !restoreCode.trim()}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {syncLoading ? "..." : "Проверить"}
              </button>
            </div>

            <button
              onClick={() => {
                const last = getCookie("ta_last_order")
                if (last) syncOrder(last)
                else setRestoreMsg("На этом устройстве ещё нет сохранённого чек-кода.")
              }}
              className="mt-2 text-left text-xs text-gray-600 underline underline-offset-4 hover:text-gray-900"
              type="button"
            >
              Проверить последнюю оплату на этом устройстве
            </button>

            {restoreMsg ? <div className="mt-2 text-xs text-gray-600">{restoreMsg}</div> : null}
          </div>
        </div>

        {/* RIGHT - PROFILE SUMMARY */}
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-2xl font-semibold">Ваш профиль</div>
            <div className="mt-1 text-gray-600">Проверить доступ и историю</div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-500">Статус</div>
              <div className="text-right">
                {loading ? "…" : summary?.logged_in ? "Вход выполнен" : "Гость"}
              </div>

              <div className="text-gray-500">Доступ</div>
              <div className="text-right">
                {loading ? "…" : access === "Paid" ? "Подписка активна" : "Бесплатно"}
              </div>

              <div className="text-gray-500">Осталось вопросов</div>
              <div className="text-right">{loading ? "…" : trialLeft}</div>
            </div>

            <div className="mt-4 flex gap-3">
              <Link href="/profile" className="flex-1 rounded-xl border px-4 py-2 text-center text-sm">
                Открыть профиль
              </Link>
              <button
                onClick={loadSummary}
                className="flex-1 rounded-xl bg-black px-4 py-2 text-sm text-white"
              >
                Обновить
              </button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-2xl font-semibold">Промокод</div>
            <div className="mt-1 text-gray-600">12 месяцев бесплатного доступа по промокоду</div>

            <div className="mt-3 flex gap-2">
              <input disabled placeholder="Промокод" className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm" />
              <button disabled className="rounded-xl border px-4 py-2 text-sm text-gray-400">
                Активировать промо
              </button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-2xl font-semibold">Управлять доступом</div>
            <div className="mt-1 text-gray-600">Подписка и промо в профиле</div>
            <Link href="/profile" className="mt-4 block rounded-xl border px-4 py-2 text-center text-sm">
              Открыть управление
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
