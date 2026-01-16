from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

pat = re.compile(
    r"^[ \t]*//\s*turbota_global_fetch_interceptor[\s\S]*?^[ \t]*\}\s*,\s*\[\s*\]\s*\)\s*\n",
    re.M
)

replacement = """  // turbota_global_fetch_interceptor
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

        // 402 paywall -> pricing + toast
        if (isAgent && res.status === 402) {
          try { sessionStorage.setItem("turbota_paywall", "trial") } catch {}
          window.dispatchEvent(new Event("turbota:refresh"))
          window.location.assign("/pricing?paywall=trial")
          return res
        }

        // successful agent/promo/clear -> refresh UI state
        if ((isAgent || isPromo || isClear) && res.ok) {
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

s2, n = pat.subn(replacement + "\n", s, count=1)
if n == 0:
    raise SystemExit("❌ Не найден блок // turbota_global_fetch_interceptor в components/header.tsx")

# на всякий случай убираем любые остатки reload, которые могли остаться после прошлых патчей
s2 = s2.replace("setTimeout(() => window.location.reload(), 50)", "")
s2 = s2.replace("window.location.reload()", "")

p.write_text(s2, "utf-8")
print("✅ header.tsx fixed: interceptor without reload (stable)")
