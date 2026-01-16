from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# 1) добавляем состояние isLoggedIn если его нет
if "const [isLoggedIn," not in s:
    s = re.sub(
        r'(const\s+\[hasAccess,\s*setHasAccess\]\s*=\s*useState<[^>]+>\([^)]*\)\s*)',
        r'\1\n  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)\n',
        s,
        count=1
    )

# 2) заменяем useEffect, который слушает turbota:refresh и тянет /api/account/summary
# ищем блок с window.addEventListener("turbota:refresh"
pat_effect = re.compile(
    r"useEffect\(\(\)\s*=>\s*\{\s*let\s+alive\s*=\s*true[\s\S]*?window\.addEventListener\(\s*\"turbota:refresh\"[\s\S]*?\}\s*,\s*\[\s*user\?\.\w+\s*\]\s*\)\s*",
    re.M
)

replacement_effect = """useEffect(() => {
    let alive = true

    const run = () => {
      loadSummary()
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return

          setIsLoggedIn(Boolean(d?.isLoggedIn))

          const left = typeof d?.trialLeft === "number" ? d.trialLeft : null
          setTrialLeft(left)

          const txt =
            typeof d?.trialText === "string"
              ? d.trialText
              : d?.access === "Paid"
              ? "Unlimited"
              : d?.access === "Promo"
              ? "Doctor access"
              : null

          setTrialText(txt)

          const accessActive =
            Boolean(d?.hasAccess) ||
            d?.access === "Paid" ||
            d?.access === "Promo"

          setHasAccess(accessActive)
        })
        .catch(() => {})
    }

    run()
    const onRefresh = () => run()
    window.addEventListener("turbota:refresh", onRefresh)

    return () => {
      alive = false
      window.removeEventListener("turbota:refresh", onRefresh)
    }
  }, [user?.email])
"""

s2, n = pat_effect.subn(replacement_effect, s, count=1)
if n == 0:
    print("⚠️ Не нашёл useEffect с turbota:refresh в header.tsx — пропускаю замену (проверь вручную).")
else:
    s = s2

# 3) бейдж Trial/Access чистим (убираем дубли)
s = s.replace(
    '{trialText ? `Access: ${trialText}` : hasAccess ? "Access: Active" : trialText ? `Access: ${trialText}` : `Trial left: ${trialLeft}`}',
    '{trialText ? `Access: ${trialText}` : hasAccess ? "Access: Active" : `Trial left: ${trialLeft}`}'
)

# 4) вместо user ? Profile : SignIn — используем isLoggedIn
s = re.sub(
    r"\{user\s*\?\s*\(",
    "{isLoggedIn ? (",
    s,
    count=2
)

# 5) полностью пересобираем interceptor (без reload циклов)
pat_interceptor = re.compile(
    r"^[ \t]*//\s*turbota_global_fetch_interceptor[\s\S]*?^[ \t]*\}\s*,\s*\[\s*\]\s*\)\s*",
    re.M
)

good_interceptor = """
  // turbota_global_fetch_interceptor
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch.bind(window)

    window.fetch = (async (input: any, init?: any) => {
      const res = await originalFetch(input, init)

      try {
        const url =
          typeof input === "string"
            ? input
            : input?.url
            ? String(input.url)
            : ""

        const isAgent = url.includes("/api/turbotaai-agent")
        const isPromo = url.includes("/api/billing/promo/redeem")
        const isClear = url.includes("/api/auth/clear")

        // paywall -> pricing + toast
        if (isAgent && res.status === 402) {
          try {
            sessionStorage.setItem("turbota_paywall", "trial")
          } catch {}
          window.dispatchEvent(new Event("turbota:refresh"))
          window.location.assign("/pricing?paywall=trial")
          return res
        }

        // logout -> чистим localStorage supabase session
        if (isClear && res.ok) {
          try {
            for (const k of Object.keys(localStorage)) {
              if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
                localStorage.removeItem(k)
              }
            }
          } catch {}

          try {
            sessionStorage.removeItem("turbota_paywall")
          } catch {}

          window.dispatchEvent(new Event("turbota:refresh"))
          return res
        }

        // success -> refresh summary in header
        if ((isAgent || isPromo) && res.ok) {
          window.dispatchEvent(new Event("turbota:refresh"))
        }
      } catch {}

      return res
    }) as any

    return () => {
      window.fetch = originalFetch as any
    }
  }, [])
"""

s2, n = pat_interceptor.subn(good_interceptor, s, count=1)
if n == 0:
    raise SystemExit("❌ Не найден блок // turbota_global_fetch_interceptor в components/header.tsx")
s = s2

p.write_text(s, "utf-8")
print("✅ header.tsx fixed: isLoggedIn from summary + stable interceptor + logout localStorage clean")
