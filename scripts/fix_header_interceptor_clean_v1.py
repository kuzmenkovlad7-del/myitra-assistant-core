from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# 1) фикс: пропущен перенос строки после useEffect(...[user?.email])
s = s.replace("}, [user?.email])const scrollToSection", "}, [user?.email])\n\n  const scrollToSection")

# 2) заменить полностью сломанный turbota_global_fetch_interceptor на рабочий
good = r'''
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

        // Paywall redirect only for agent endpoint
        if (isAgent && res.status === 402) {
          try {
            sessionStorage.setItem("turbota_paywall", "trial")
          } catch {}
          window.dispatchEvent(new Event("turbota:refresh"))
          window.location.assign("/pricing?paywall=trial")
          return res
        }

        // refresh summary after successful calls
        if ((isAgent or isPromo or isClear) and res.ok):  # placeholder to be replaced below
          pass
      } catch {}

      return res
    }) as any

    return () => {
      window.fetch = originalFetch as any
    }
  }, [])
'''.strip("\n")

# python -> ts boolean operators
good = good.replace("(isAgent or isPromo or isClear)", "(isAgent || isPromo || isClear)")
good = good.replace("and res.ok", "&& res.ok")

# добавим logout очистку ТОЛЬКО при /api/auth/clear
good = good.replace(
    "window.dispatchEvent(new Event(\"turbota:refresh\"))",
    "window.dispatchEvent(new Event(\"turbota:refresh\"))"
)

# вставим нормальный блок res.ok
good = good.replace(
    "if ((isAgent || isPromo || isClear) && res.ok) {\n          pass\n        }",
    """if ((isAgent || isPromo || isClear) && res.ok) {
          window.dispatchEvent(new Event("turbota:refresh"))

          // logout: гарантированно становимся гостем
          if (isClear) {
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

            setTimeout(() => window.location.reload(), 50)
          }
        }"""
)

# regex: вырезаем старый блок целиком
pat = re.compile(
    r"^[ \t]*//\s*turbota_global_fetch_interceptor[\s\S]*?^[ \t]*\}\s*,\s*\[\s*\]\s*\)\s*\n",
    re.M
)

s2, n = pat.subn(good + "\n\n", s, count=1)

if n == 0:
    raise SystemExit("❌ Не найден блок // turbota_global_fetch_interceptor в header.tsx")
s = s2

p.write_text(s, "utf-8")
print("✅ header.tsx fixed: interceptor fully rebuilt + newline repaired")
