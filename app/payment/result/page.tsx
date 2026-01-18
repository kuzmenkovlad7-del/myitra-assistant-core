"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

type BillingStatus = "paid" | "failed" | "processing" | "not_found" | "unknown";

function normalizeStatus(s: any): BillingStatus {
  const v = String(s || "").toLowerCase();
  if (v === "paid") return "paid";
  if (v === "failed") return "failed";
  if (v === "processing") return "processing";
  if (v === "not_found") return "not_found";
  return "unknown";
}

export default function PaymentResultPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const orderReference = sp.get("orderReference")?.trim() || "";
  const debug = sp.get("debug") === "1";

  const [status, setStatus] = React.useState<BillingStatus>("processing");
  const [loading, setLoading] = React.useState(false);
  const [tries, setTries] = React.useState(0);

  const fetchStatus = React.useCallback(async () => {
    if (!orderReference) {
      setStatus("failed");
      return;
    }

    try {
      const res = await fetch(
        `/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`,
        { cache: "no-store" }
      );

      const json: any = await res.json().catch(() => ({}));

      if (debug) {
        console.log("[billing][result] status", { httpStatus: res.status, json });
      }

      if (!res.ok || !json?.ok) {
        setStatus("unknown");
        return;
      }

      setStatus(normalizeStatus(json.status));
    } catch (e) {
      if (debug) console.log("[billing][result] status fetch error", e);
      setStatus("unknown");
    }
  }, [orderReference, debug]);

  const forceCheck = React.useCallback(async () => {
    if (!orderReference) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/billing/wayforpay/check?orderReference=${encodeURIComponent(orderReference)}`,
        { method: "POST", cache: "no-store" }
      );

      const json: any = await res.json().catch(() => ({}));
      if (debug) console.log("[billing][result] forceCheck", { httpStatus: res.status, json });

      // после check сразу повторяем status
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  }, [orderReference, fetchStatus, debug]);

  // Первичная проверка + максимум 6 попыток автопроверки
  React.useEffect(() => {
    let mounted = true;
    let timer: any = null;

    const run = async () => {
      await fetchStatus();
      if (!mounted) return;

      setTries(0);

      timer = setInterval(async () => {
        // если уже финальный статус — стоп
        if (status === "paid" || status === "failed") return;

        setTries((t) => {
          const next = t + 1;
          return next;
        });
      }, 1500);
    };

    run();

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderReference]);

  // отдельный эффект чтобы реально делать запросы по tries
  React.useEffect(() => {
    if (!orderReference) return;
    if (status === "paid" || status === "failed") return;

    if (tries > 0 && tries <= 6) {
      fetchStatus();
    }
    // после 6 попыток не спамим сеть
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);

  const goProfile = () => router.push("/profile");
  const goHome = () => router.push("/");

  const ui = (() => {
    if (!orderReference) {
      return {
        title: "Ошибка оплаты",
        subtitle: "Не найден orderReference. Попробуйте ещё раз или обратитесь в поддержку.",
        icon: <XCircle className="h-8 w-8 text-red-600" />,
      };
    }

    if (status === "paid") {
      return {
        title: "Оплата подтверждена",
        subtitle: "Доступ активирован. Можете переходить в кабинет.",
        icon: <CheckCircle2 className="h-8 w-8 text-green-600" />,
      };
    }

    if (status === "failed") {
      return {
        title: "Оплата не прошла",
        subtitle: "Оплата не подтверждена. Попробуйте ещё раз или обратитесь в поддержку.",
        icon: <XCircle className="h-8 w-8 text-red-600" />,
      };
    }

    return {
      title: "Проверяем оплату",
      subtitle: "Подождите пару секунд. Если не обновится — нажмите Проверить ещё раз.",
      icon: <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />,
    };
  })();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{ui.icon}</div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-card-foreground">{ui.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{ui.subtitle}</p>

            {orderReference ? (
              <p className="mt-2 text-xs text-muted-foreground/70">
                orderReference: {orderReference}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button className="flex-1" onClick={goProfile}>
            В кабинет
          </Button>
          <Button variant="outline" className="flex-1" onClick={goHome}>
            На главную
          </Button>
        </div>

        <Button
          variant="ghost"
          className="mt-3 w-full gap-2"
          onClick={forceCheck}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          {loading ? "Проверяем..." : "Проверить ещё раз"}
        </Button>

        <div className="mt-5 text-center text-xs text-muted-foreground">
          support@turbotaai.com
        </div>
      </div>
    </div>
  );
}
