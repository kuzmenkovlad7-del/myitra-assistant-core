"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  ok: boolean;
  isLoggedIn: boolean;
  email: string | null;
  access: "Paid" | "Promo" | "Limited";
  trialLeft: number;
  paidUntil: string | null;
  promoUntil: string | null;
};

function fmtDate(v: string | null) {
  if (!v) return "Not active";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Not active";
  return d.toLocaleString();
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Summary | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" });
      const data = (await r.json().catch(() => ({}))) as Summary;
      setS(data);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/clear", { method: "POST", credentials: "include" }).catch(() => null);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    load();
  }, []);

  const isLoggedIn = !!s?.isLoggedIn;
  const email = s?.email || "Guest";
  const access = (s as any)?.access || "Limited";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-semibold">Profile</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-full border border-slate-200" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
          <Button variant="outline" className="rounded-full border border-slate-200" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Account</CardTitle>
            <CardDescription>Login status and access</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : (
              <>
                <div>
                  <span className="text-slate-500">Email:</span> <span className="font-medium">{email}</span>
                </div>
                <div>
                  <span className="text-slate-500">Access:</span> <span className="font-medium">{access}</span>
                </div>
                <div>
                  <span className="text-slate-500">{(s as any)?.unlimited ? "Access:" : (s?.access === "Paid" || s?.access === "Promo") ? "Access:" : "Trial left:"}</span>{" "}
                  <span className="font-medium">{((s as any)?.unlimited ? ((s as any)?.trialText ?? ((s as any)?.access === "Paid" ? "Unlimited" : "Doctor access")) : ((s?.access === "Paid" ? "Unlimited" : s?.access === "Promo" ? "Doctor access" : (typeof s?.trialLeft === "number" ? s?.trialLeft : 0))))}</span>
                </div>
                <div>
                  <span className="text-slate-500">Paid until:</span>{" "}
                  <span className="font-medium">{fmtDate(s?.paidUntil ?? null)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Promo until:</span>{" "}
                  <span className="font-medium">{fmtDate(s?.promoUntil ?? null)}</span>
                </div>

                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full rounded-full border border-slate-200"
                    onClick={() => router.push("/pricing")}
                  >
                    Manage subscription
                  </Button>
                </div>

                {!isLoggedIn ? <div className="pt-2 text-xs text-slate-500">Log in to unlock saved sessions and promo.</div> : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">History</CardTitle>
            <CardDescription>Saved sessions</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            {isLoggedIn ? "History will appear here after first session." : "Login to see history."}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
