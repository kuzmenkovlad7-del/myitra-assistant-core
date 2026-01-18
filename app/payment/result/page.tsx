"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MissionSuccessDialog } from "@/components/ui/mission-success-dialog";

type BillingStatus = "paid" | "failed" | "processing" | "pending" | "not_found" | "unknown";

type StatusResp = {
  ok: boolean;
  status?: BillingStatus;
  orderReference?: string;
  updatedAt?: string;
  createdAt?: string;
  raw?: any;
  error?: string;
};

export default function PaymentResultPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const orderReference = sp.get("orderReference") || "";
  const debug = sp.get("debug") === "1";

  const [status, setStatus] = useState<BillingStatus | "checking" | "error">("checking");
  const [details, setDetails] = useState<StatusResp | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);

  const pollRef = useRef<number | null>(null);
  const didAutoCheckRef = useRef(false);

  const statusTitle = useMemo(() => {
    if (status === "paid") return "Оплата подтверждена";
    if (status === "failed") return "Оплата не прошла";
    if (status === "processing" || status === "pending" || status === "checking") return "Проверяем оплату";
    if (status === "not_found") return "Платёж не найден";
    return "Ошибка проверки";
  }, [status]);

  const statusDesc = useMemo(() => {
    if (status === "paid") return "Доступ активирован. Можете переходить в кабинет.";
    if (status === "failed") return "Оплата не подтверждена. Попробуйте ещё раз или обратитесь в поддержку.";
    if (status === "processing" || status === "pending") return "Платёж обрабатывается. Обычно это занимает несколько секунд.";
    if (status === "checking") return "Получаем статус заказа…";
    if (status === "not_found") return "Заказ пока не появился в системе. Нажмите Проверить ещё раз.";
    return "Не удалось получить статус. Нажмите Проверить ещё раз.";
  }, [status]);

  async function fetchStatus() {
    if (!orderReference) {
      setStatus("error");
      return;
    }

    try {
      console.log("[billing][result] fetchStatus start", { orderReference });

      const url = `/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}${
        debug ? "&debug=1" : ""
      }`;

      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const json = (await res.json().catch(() => null)) as StatusResp | null;

      if (!res.ok || !json) {
        console.log("[billing][result] fetchStatus bad response", { status: res.status, json });
        setStatus("error");
        return;
      }

      setDetails(json);

      const nextStatus = (json.status || "unknown") as BillingStatus;
      setStatus(nextStatus);

      console.log("[billing][result] fetchStatus ok", { orderReference, nextStatus });

      // Если подтвердилось — открываем красивый попап
      if (nextStatus === "paid") setDialogOpen(true);
    } catch (e) {
      console.log("[billing][result] fetchStatus exception", e);
      setStatus("error");
    }
  }

  async function forceCheck() {
    if (!orderReference) return;

    try {
      console.log("[billing][result] forceCheck start", { orderReference });

      const res = await fetch(
        `/api/billing/wayforpay/check?orderReference=${encodeURIComponent(orderReference)}`,
        { method: "GET", cache: "no-store" }
      );

      const json = await res.json().catch(() => null);
      console.log("[billing][result] forceCheck response", { httpStatus: res.status, json });

      await fetchStatus();
    } catch (e) {
      console.log("[billing][result] forceCheck exception", e);
    }
  }

  function startPolling() {
    if (pollRef.current) window.clearInterval(pollRef.current);

    let ticks = 0;
    pollRef.current = window.setInterval(async () => {
      ticks += 1;

      // максимум ~30 секунд
      if (ticks > 15) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }

      await fetchStatus();
    }, 2000);
  }

  useEffect(() => {
    // старт
    fetchStatus();

    // авто-пулл если статус не paid/failed
    startPolling();

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderReference]);

  useEffect(() => {
    // Один раз делаем принудительный checkStatus в WayForPay,
    // чтобы не ждать webhook если он задержался.
    if (
      !didAutoCheckRef.current &&
      (status === "processing" || status === "pending" || status === "not_found" || status === "checking")
    ) {
      didAutoCheckRef.current = true;
      setTimeout(() => {
        forceCheck();
      }, 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const Icon = useMemo(() => {
    if (status === "paid") return <CheckCircle2 className="h-7 w-7 text-emerald-600" />;
    if (status === "failed") return <XCircle className="h-7 w-7 text-red-500" />;
    if (status === "checking" || status === "processing" || status === "pending")
      return <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />;
    return <XCircle className="h-7 w-7 text-muted-foreground" />;
  }, [status]);

  return (
    <div className="min-h-[70vh] w-full px-4">
      <div className="mx-auto mt-16 w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1">{Icon}</div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{statusTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{statusDesc}</p>

            {orderReference && (
              <div className="mt-3 text-xs text-muted-foreground">
                orderReference: <span className="font-mono">{orderReference}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            className="min-w-[140px]"
            onClick={() => router.push("/profile")}
            disabled={status !== "paid"}
          >
            В кабинет
          </Button>

          <Button variant="outline" className="min-w-[140px]" onClick={() => router.push("/")}>
            На главную
          </Button>

          <Button
            variant="secondary"
            className="min-w-[170px]"
            onClick={() => fetchStatus()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Проверить ещё раз
          </Button>
        </div>

        {debug && details?.raw && (
          <div className="mt-6">
            <button
              className="text-sm text-muted-foreground underline underline-offset-4"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              {detailsOpen ? "Скрыть детали" : "Показать детали"}
            </button>

            {detailsOpen && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-secondary p-4 text-xs text-secondary-foreground">
{JSON.stringify(details.raw, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="mt-6 text-xs text-muted-foreground">
          support@turbotaai.com
        </div>
      </div>

      {/* Красивый попап только на успех */}
      <MissionSuccessDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        illustration={<CheckCircle2 className="h-12 w-12 text-emerald-600" />}
        title="Оплата прошла успешно"
        titleIcon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        description="Доступ к тарифу активирован. Можете сразу перейти в кабинет."
        showInput={false}
        primaryButtonText="Перейти в кабинет"
        onPrimaryClick={() => router.push("/profile")}
        secondaryButtonText="На главную"
        onSecondaryClick={() => router.push("/")}
        badgeText="TurbotaAI"
      />
    </div>
  );
}
