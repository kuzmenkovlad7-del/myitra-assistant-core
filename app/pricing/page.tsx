"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function safeNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getPriceUAH(): number {
  const raw = process.env.NEXT_PUBLIC_PRICE_UAH;
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return 499;
}

type ProfileBox = {
  loggedIn: boolean;
  accessLabel: string;
  questionsLeft: number | null;
};

export default function PricingPage() {
  const priceUAH = useMemo(() => getPriceUAH(), []);

  const [promo, setPromo] = useState("");
  const [box, setBox] = useState<ProfileBox>({
    loggedIn: false,
    accessLabel: "Безкоштовно",
    questionsLeft: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // 1) Кто залогинен?
        let loggedIn = false;
        try {
          const r = await fetch("/api/account/summary", { cache: "no-store" });
          if (r.ok) {
            const j = await r.json().catch(() => null);
            loggedIn = Boolean(j?.ok);
          }
        } catch {}

        // 2) Сколько осталось вопросов (работает и без логина)
        let questionsLeft: number | null = null;
        let accessLabel = "Безкоштовно";

        try {
          const r = await fetch("/api/subscription/summary", { cache: "no-store" });
          const j = await r.json().catch(() => null);

          questionsLeft =
            safeNumber(j?.questionsLeft) ??
            safeNumber(j?.questions_left) ??
            safeNumber(j?.remainingQuestions) ??
            safeNumber(j?.remaining_questions) ??
            safeNumber(j?.trialLeft) ??
            safeNumber(j?.trial_left) ??
            safeNumber(j?.remaining) ??
            safeNumber(j?.left) ??
            null;

          const paid =
            Boolean(j?.isPaid) ||
            Boolean(j?.paid) ||
            Boolean(j?.subscription?.active) ||
            j?.plan === "paid" ||
            j?.tier === "paid";

          accessLabel = paid ? "Оплачено" : "Безкоштовно";
        } catch {}

        if (cancelled) return;
        setBox({
          loggedIn,
          accessLabel,
          questionsLeft: questionsLeft ?? 5,
        });
      } catch {
        if (cancelled) return;
        setBox((p) => ({ ...p, questionsLeft: 5 }));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-4xl font-semibold tracking-tight">Тарифи</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Безлімітний доступ до чату, голосу і відео. Пробний режим має 5 запитань.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          {/* LEFT: plan card */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-2xl">Щомісяця</CardTitle>
              <CardDescription>Безлімітний доступ до чату, голосу і відео</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* PRICE */}
              <div className="flex items-end gap-3">
                <div className="text-6xl font-bold leading-none">{priceUAH}</div>
                <div className="pb-2 text-sm text-muted-foreground">UAH</div>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Безлімітна кількість запитів</li>
                <li>• Чат, голос і відео</li>
                <li>• Історія зберігається у профілі</li>
              </ul>

              {/* BEAUTIFUL CARD (RESTORED) */}
              <div className="rounded-2xl p-[1px] bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a3d7a] via-[#0f6fbf] to-[#0b7bc5] p-6 text-white">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,white,transparent_40%)]" />

                  <div className="relative flex items-center justify-between">
                    <div className="text-sm font-medium opacity-90">TurbotaAI</div>
                    <div className="h-8 w-12 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-300 opacity-90" />
                  </div>

                  <div className="relative mt-10 text-xl font-semibold">TurbotaAI Monthly</div>
                  <div className="relative mt-2 text-sm opacity-80">
                    {priceUAH} UAH / місяць
                  </div>

                  <div className="relative mt-6 flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-white/80" />
                    <div className="h-2 w-2 rounded-full bg-white/60" />
                    <div className="h-2 w-2 rounded-full bg-white/40" />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => window.location.assign("/api/billing/wayforpay/purchase?planId=monthly")}
              >
                Оплатити {priceUAH} UAH
              </Button>
            </CardContent>
          </Card>

          {/* RIGHT: profile box */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Ваш профіль</CardTitle>
                <CardDescription>Перевірити доступ і історію</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground">Статус</div>
                  <div className="text-right">{box.loggedIn ? "Вхід виконано" : "Не виконано"}</div>

                  <div className="text-muted-foreground">Доступ</div>
                  <div className="text-right">{box.accessLabel}</div>

                  <div className="text-muted-foreground">Залишилось запитань</div>
                  <div className="text-right">{box.questionsLeft ?? 5}</div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.assign("/profile")}
                  >
                    Відкрити профіль
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.assign("/api/auth/logout")}
                  >
                    Вийти
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Промокод</CardTitle>
                <CardDescription>12 місяців безкоштовного доступу за промокодом</CardDescription>
              </CardHeader>

              <CardContent className="flex gap-3">
                <Input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Промокод" />
                <Button variant="outline" disabled={!promo.trim()}>
                  Активувати промо
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Керувати доступом</CardTitle>
                <CardDescription>Підписка та промо у профілі</CardDescription>
              </CardHeader>

              <CardContent>
                <Button className="w-full" onClick={() => window.location.assign("/profile")}>
                  Відкрити налаштування
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Якщо потрібно перевірити підпис WayForPay без оплати:{" "}
          <span className="font-mono">/api/billing/wayforpay/purchase?planId=monthly&debug=1</span>
        </div>
      </div>
    </div>
  );
}
