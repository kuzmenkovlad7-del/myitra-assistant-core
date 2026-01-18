"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Clock3, Bug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MissionSuccessDialog } from "@/components/ui/mission-success-dialog";

type PayState = "checking" | "paid" | "processing" | "failed" | "error";

export default function PaymentResultPage() {
  const sp = useSearchParams();
  const orderReference = sp.get("orderReference") || "";
  const debug = sp.get("debug") === "1";

  const [state, setState] = React.useState<PayState>("checking");
  const [details, setDetails] = React.useState<any>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [showDebug, setShowDebug] = React.useState(debug);

  const loadStatus = React.useCallback(async () => {
    if (!orderReference) {
      setState("error");
      setDetails({ error: "missing_orderReference_in_url" });
      return;
    }

    try {
      setState("checking");

      const res = await fetch(
        `/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`,
        { cache: "no-store" }
      );

      const json = await res.json().catch(() => null);

      const pack = {
        httpStatus: res.status,
        ok: json?.ok,
        status: json?.status,
        orderReference: json?.orderReference,
        raw: json?.raw,
        error: json?.error,
        details: json?.details,
      };

      setDetails(pack);

      if (!res.ok || !json?.ok) {
        setState("error");
        return;
      }

      const s = String(json.status || "").toLowerCase();

      if (s === "paid") {
        setState("paid");
        setDialogOpen(true);
        return;
      }

      if (s === "processing" || s === "pending") {
        setState("processing");
        return;
      }

      setState("failed");
    } catch (e: any) {
      setState("error");
      setDetails({ error: "fetch_failed", details: String(e?.message || e) });
    }
  }, [orderReference]);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Автопуллинг если платеж еще обрабатывается
  React.useEffect(() => {
    if (state !== "processing" && state !== "checking") return;

    const t = setInterval(() => {
      loadStatus();
    }, 2500);

    return () => clearInterval(t);
  }, [state, loadStatus]);

  const title =
    state === "paid"
      ? "Оплата подтверждена"
      : state === "processing"
      ? "Платёж в обработке"
      : state === "failed"
      ? "Оплата не подтверждена"
      : state === "checking"
      ? "Проверяем оплату"
      : "Не удалось проверить статус";

  const subtitle =
    state === "paid"
      ? "Доступ активирован. Можете переходить в кабинет."
      : state === "processing"
      ? "Обычно занимает несколько секунд. Страница обновится автоматически."
      : state === "failed"
      ? "Если деньги списались, напишите в поддержку."
      : state === "checking"
      ? "Запрашиваем статус из базы данных…"
      : "Обновите страницу через 10 секунд или нажмите Проверить ещё раз.";

  const Icon =
    state === "paid"
      ? CheckCircle2
      : state === "processing"
      ? Clock3
      : state === "checking"
      ? Loader2
      : state === "failed"
      ? XCircle
      : XCircle;

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      {/* Success dialog */}
      <MissionSuccessDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        imageUrl="https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=800&q=80"
        title="Оплата прошла успешно"
        description="Доступ к тарифу активирован. Можете сразу зайти в кабинет."
        inputPlaceholder="Email для чека, если нужно"
        primaryButtonText="Перейти в кабинет"
        onPrimaryClick={() => {
          window.location.href = "/dashboard";
        }}
        secondaryButtonText="На главную"
        onSecondaryClick={() => {
          window.location.href = "/";
        }}
        badgeText="TurbotaAI"
        badgeIcon={<Bug className="h-3 w-3" />}
      />

      <div className="w-full max-w-xl rounded-2xl border bg-white/70 backdrop-blur p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <Icon
              className={[
                "h-8 w-8",
                state === "checking" ? "animate-spin" : "",
                state === "paid" ? "text-green-600" : "",
                state === "processing" ? "text-orange-500" : "",
                state === "failed" ? "text-red-600" : "",
                state === "error" ? "text-red-600" : "",
              ].join(" ")}
            />
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-black">{title}</h1>
            <p className="mt-2 text-sm text-black/70">{subtitle}</p>

            <div className="mt-3 text-xs text-black/50 break-all">
              orderReference: {orderReference || "—"}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="flex-1 rounded-xl bg-black text-white px-4 py-2 text-center font-medium"
              >
                На главную
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 rounded-xl border border-black/15 px-4 py-2 text-center"
              >
                В кабинет
              </Link>
              <Button
                variant="outline"
                className="sm:w-auto"
                onClick={() => loadStatus()}
              >
                Проверить ещё раз
              </Button>
            </div>

            <div className="mt-6">
              <button
                className="text-xs text-black/60 hover:text-black underline underline-offset-4"
                onClick={() => setShowDebug((v) => !v)}
                type="button"
              >
                {showDebug ? "Скрыть детали" : "Показать детали"}
              </button>

              {showDebug && (
                <pre className="mt-3 text-[11px] bg-black/5 p-3 rounded-xl overflow-auto max-h-64">
{JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>

            <div className="mt-5 text-xs text-black/60">
              support@turbotaai.com
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
