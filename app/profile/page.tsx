"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type SummaryLike = {
  logged_in?: boolean
  email?: string | null
  trial_questions_left?: number | null
  paid_until?: string | null
  promo_until?: string | null
  access?: string | null
  autoRenew?: boolean | null
  subscriptionStatus?: string | null
}

function isActive(iso?: string | null) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t > Date.now()
}

function clearClientAuthStorage() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k)
    }
  } catch {}

  try {
    sessionStorage.removeItem("turbota_paywall")
    sessionStorage.removeItem("turbota_conv_id")
  } catch {}
}

function formatIso(iso?: string | null) {
  if (!iso) return "Не активно"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString()
}

export default function ProfilePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SummaryLike | null>(null)

  const access = useMemo(() => {
    if (!summary) return "Trial"
    if (summary.access) return summary.access
    if (isActive(summary.paid_until)) return "Paid"
    if (isActive(summary.promo_until)) return "Promo"
    return "Trial"
  }, [summary])

  const unlimited = access === "Paid" || access === "Promo"

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
        logged_in: !!(j?.isLoggedIn ?? j?.logged_in ?? j?.user?.id),
        email: j?.user?.email ?? j?.email ?? null,
        trial_questions_left: j?.trial_questions_left ?? j?.trialLeft ?? 5,
        paid_until: j?.paidUntil ?? j?.paid_until ?? null,
        promo_until: j?.promoUntil ?? j?.promo_until ?? null,
        access: j?.access ?? null,
        autoRenew: typeof j?.autoRenew === "boolean" ? j.autoRenew : null,
        subscriptionStatus: j?.subscriptionStatus ?? null,
      }

      setSummary(s)

      try {
        window.dispatchEvent(new Event("turbota:refresh"))
      } catch {}
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const isLoggedIn = !!summary?.logged_in

  async function doLogout() {
    clearClientAuthStorage()
    window.location.assign("/api/auth/logout")
  }

  const accessLabel =
    access === "Paid"
      ? "Подписка активна"
      : access === "Promo"
      ? "Промо активно"
      : "Бесплатно"

  const subscriptionStatusLabel = String(summary?.subscriptionStatus || "").trim() || (unlimited ? "active" : "inactive")

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-5xl font-semibold tracking-tight">Профиль</div>
          <div className="mt-2 text-gray-600">Управление доступом и история</div>
        </div>

        <div className="flex gap-3">
          <Link href="/pricing" className="rounded-full border px-5 py-2 text-sm">
            Тарифы
          </Link>

          {isLoggedIn ? (
            <button onClick={doLogout} className="rounded-full border px-5 py-2 text-sm">
              Выйти
            </button>
          ) : (
            <Link href="/login?next=/profile" className="rounded-full border px-5 py-2 text-sm">
              Войти
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-2xl font-semibold">Аккаунт</div>
          <div className="mt-1 text-gray-600">Статус входа и доступ</div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="text-gray-500">Email:</div>
            <div className="text-right">{loading ? "…" : summary?.email || "Гость"}</div>

            <div className="text-gray-500">Доступ:</div>
            <div className="text-right">{loading ? "…" : accessLabel}</div>

            <div className="text-gray-500">Осталось вопросов:</div>
            <div className="text-right">{loading ? "…" : unlimited ? "∞" : trialLeft}</div>

            <div className="text-gray-500">Оплачено до:</div>
            <div className="text-right">{loading ? "…" : formatIso(summary?.paid_until)}</div>

            <div className="text-gray-500">Промо до:</div>
            <div className="text-right">{loading ? "…" : formatIso(summary?.promo_until)}</div>
          </div>

          <div className="mt-5 grid gap-3">
            <button onClick={loadSummary} className="w-full rounded-xl border px-4 py-2 text-sm">
              Обновить
            </button>
            <Link href="/pricing" className="w-full rounded-xl border px-4 py-2 text-center text-sm">
              Тарифы
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-2xl font-semibold">Управление доступом</div>
          <div className="mt-1 text-gray-600">Подписка и промокод</div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="text-gray-500">Статус подписки:</div>
            <div className="text-right">{loading ? "…" : subscriptionStatusLabel}</div>

            <div className="text-gray-500">Автопродление:</div>
            <div className="text-right">{loading ? "…" : summary?.autoRenew ? "Включено" : "Выключено"}</div>
          </div>

          <div className="mt-4 space-y-3">
            <button disabled className="w-full rounded-xl border px-4 py-2 text-sm text-gray-400">
              Отменить автопродление
            </button>
            <button disabled className="w-full rounded-xl border px-4 py-2 text-sm text-gray-400">
              Отменить промокод
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-2xl font-semibold">История</div>
        <div className="mt-1 text-gray-600">Сохранённые сессии</div>

        {isLoggedIn ? (
          <div className="mt-4 text-sm text-gray-600">История будет доступна в следующем обновлении.</div>
        ) : (
          <div className="mt-4 text-sm text-gray-600">Войдите, чтобы видеть историю.</div>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-500">
        Тест оплаты: чтобы выставить сумму 1 грн, добавьте env TA_FORCE_AMOUNT_UAH=1 и сделайте redeploy. Чтобы вернуть 499, удалите TA_FORCE_AMOUNT_UAH.
      </div>
    </div>
  )
}
