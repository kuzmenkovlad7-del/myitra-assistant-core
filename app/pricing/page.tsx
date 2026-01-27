"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PLANS } from "@/lib/billing/plans"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth/auth-context"

function promoErrorText(httpStatus: number, data: any) {
  const code = String(data?.errorCode || "").toUpperCase().trim()

  if (httpStatus === 401 || code === "LOGIN_REQUIRED") return "Чтобы активировать промокод, нужно войти в аккаунт"
  if (code === "EMPTY_CODE") return "Введите промокод"
  if (code === "INVALID_PROMO") return "Промокод недействителен или уже неактивен"
  if (code === "REDEEM_FAILED") return "Не удалось активировать промокод, попробуйте еще раз"

  const msg = String(data?.error || data?.message || "").trim()
  return msg || "Не удалось активировать промокод"
}

function formatIso(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function PricingPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [promo, setPromo] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<string | null>(null)

  const startPayment = async (planId: string) => {
    setLoadingPlan(planId)
    try {
      const res = await fetch("/api/billing/wayforpay/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.invoiceUrl) throw new Error(String(data?.error || "Payment init failed"))
      window.location.href = data.invoiceUrl
    } catch (e: any) {
      alert(String(e?.message || "Payment init failed"))
    } finally {
      setLoadingPlan(null)
    }
  }

  const redeemPromo = async () => {
    setPromoMsg(null)
    setPromoLoading(true)
    try {
      const res = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setPromoMsg(promoErrorText(res.status, data))
        return
      }

      const iso = String(data?.promo_until || data?.promoUntil || "").trim()
      if (!iso) {
        setPromoMsg("Промо активировано, но дата не пришла. Обновите профиль")
      } else {
        setPromoMsg(`Промо активировано до: ${formatIso(iso)}`)
      }

      try {
        window.dispatchEvent(new Event("turbota:refresh"))
      } catch {}
    } catch (e: any) {
      setPromoMsg(String(e?.message || "Promo failed"))
    } finally {
      setPromoLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900">Pricing</h1>
        <p className="mt-2 text-slate-600">
          Unlimited access to chat, voice and video sessions. Trial includes 5 questions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {PLANS.map((p) => (
          <Card key={p.id} className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">{p.title}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-4xl font-semibold text-slate-900">
                {p.amount} <span className="text-base font-medium text-slate-500">{p.currency}</span>
              </div>

              <ul className="text-sm text-slate-700 space-y-2">
                <li>• Unlimited questions</li>
                <li>• Chat, voice and video</li>
                <li>• History saved in your profile</li>
              </ul>

              <Button
                className="w-full"
                onClick={() => startPayment(p.id)}
                disabled={loadingPlan === p.id}
              >
                {loadingPlan === p.id ? "Opening payment..." : "Subscribe"}
              </Button>

              {!user ? (
                <p className="text-xs text-slate-500">
                  You can pay without login. For promo activation and history we recommend logging in.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Promo for doctors</CardTitle>
            <CardDescription>12 months free access by promo code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="promo">Promo code</Label>
              <Input id="promo" value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="DOCTORS2026" />
            </div>

            <Button onClick={redeemPromo} disabled={promoLoading}>
              {promoLoading ? "Activating..." : "Activate promo"}
            </Button>

            {promoMsg ? <p className="text-sm text-slate-700">{promoMsg}</p> : null}

            {!user ? (
              <p className="text-xs text-slate-500">
                Promo activation requires login.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Check trial balance and history</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => router.push("/profile")}>
              Open profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
