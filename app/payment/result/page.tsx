"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SyncResp = {
  ok?: boolean;
  state?: string;
  orderReference?: string;
  error?: string;
};

export default function PaymentResultPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderReference = sp.get("orderReference") || "";

  const [state, setState] = useState<"checking" | "ok" | "fail">("checking");
  const [msg, setMsg] = useState("Перевіряємо оплату…");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;

    async function syncOnce(): Promise<boolean> {
      const base = "/api/billing/wayforpay/sync";
      const url = orderReference ? `${base}?orderReference=${encodeURIComponent(orderReference)}` : base;

      try {
        const r = await fetch(url, { method: "POST", cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as SyncResp;

        if (j?.ok) return true;

        return false;
      } catch {
        return false;
      }
    }

    async function run() {
      setState("checking");
      setMsg("Перевіряємо оплату…");

      for (let i = 1; i <= 10; i++) {
        if (!alive) return;
        setAttempt(i);

        const ok = await syncOnce();
        if (!alive) return;

        if (ok) {
          setState("ok");
          setMsg("Оплату підтверджено. Доступ активовано.");
          setTimeout(() => router.replace("/profile?paid=1"), 500);
          return;
        }

        setMsg("Оплату поки не підтверджено. Якщо Ви оплатили, зачекайте або натисніть Перевірити знову.");
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (!alive) return;
      setState("fail");
      setMsg("Оплату не підтверджено. Якщо Ви оплатили, натисніть Перевірити знову.");
    }

    run();
    return () => {
      alive = false;
    };
  }, [orderReference, router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Результат оплати</h1>

        <div className="mt-2 text-sm text-gray-600">
          Чек-код: <span className="font-mono text-gray-900">{orderReference || "—"}</span>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
          {msg}
          {state === "checking" ? <div className="mt-2 text-xs text-gray-500">Спроба: {attempt}/10</div> : null}
        </div>

        {state === "fail" ? (
          <div className="mt-4 flex gap-2">
            <button onClick={() => location.reload()} className="flex-1 rounded-xl bg-black px-4 py-2 text-white">
              Перевірити знову
            </button>
            <button onClick={() => router.replace("/pricing")} className="flex-1 rounded-xl border px-4 py-2">
              Тарифи
            </button>
          </div>
        ) : null}

        {state === "ok" ? (
          <button
            onClick={() => router.replace("/profile?paid=1")}
            className="mt-4 w-full rounded-xl bg-black px-4 py-2 text-white"
          >
            Перейти в профіль
          </button>
        ) : null}

        <div className="mt-4 text-xs text-gray-500">
          Порада: щоб не втратити доступ при очищенні cookie, увійдіть або зареєструйтесь і привʼяжіть доступ до акаунта.
        </div>
      </div>
    </div>
  );
}
