from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# 0) Удаляем криво вставленные блоки (если попали внутрь const url = ... ? ... : ...)
# Удаляем любые куски с url.includes("/api/auth/clear") и url.includes("/api/billing/promo/redeem"),
# которые НЕ должны быть внутри расчёта url.
s = re.sub(
    r"\n\s*if\s*\(\s*url\.includes\(\"/api/auth/clear\"\)\s*\)\s*\{[\s\S]*?\n\s*\}\s*\n",
    "\n",
    s
)
s = re.sub(
    r"\n\s*if\s*\(\s*url\.includes\(\"/api/billing/promo/redeem\"\)\s*\)\s*\{[\s\S]*?\n\s*\}\s*\n",
    "\n",
    s
)

# 1) В fetch interceptor добавляем /api/auth/clear в общий блок (чтобы ловить logout)
s = s.replace(
    'if (url.includes("/api/turbotaai-agent") || url.includes("/api/billing/promo/redeem")) {',
    'if (url.includes("/api/turbotaai-agent") || url.includes("/api/billing/promo/redeem") || url.includes("/api/auth/clear")) {'
)

# 2) Редирект на paywall делаем ТОЛЬКО для /api/turbotaai-agent (иначе может триггерить не там)
s = s.replace(
    "if (res.status === 402) {",
    'if (url.includes("/api/turbotaai-agent") && res.status === 402) {'
)

# 3) В ветке res.ok добавляем нормальную обработку logout:
# - чистим sb auth-token из localStorage
# - диспатчим refresh
# - делаем лёгкий reload, чтобы UI 100% стал гостем
if "url.includes(\"/api/auth/clear\")" not in s:
    # найдём место: "} else if (res.ok) {"
    marker = "} else if (res.ok) {"
    if marker in s:
        inject = """
            if (url.includes("/api/auth/clear")) {
              try {
                for (const k of Object.keys(localStorage)) {
                  if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
                    localStorage.removeItem(k)
                  }
                }
              } catch {}
              try { sessionStorage.removeItem("turbota_paywall") } catch {}
              // чтобы UI не "зависал" в logged-in состоянии
              setTimeout(() => window.location.reload(), 50)
            }
"""
        s = s.replace(marker, marker + inject, 1)

# 4) Делает реальный refresh по событию turbota:refresh (у тебя dispatch был, а слушателя НЕ было)
# Полностью переписываем useEffect loadSummary на версию, которая:
# - грузит сразу
# - слушает turbota:refresh
pat = re.compile(
    r"useEffect\(\(\)\s*=>\s*\{\s*loadSummary\(\)[\s\S]*?\}\s*,\s*\[\s*user\?\.\s*email\s*\]\s*\)\s*",
    re.M
)

replacement = """useEffect(() => {
    let alive = true

    const run = () => {
      loadSummary()
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          setTrialLeft(typeof d?.trialLeft === "number" ? d.trialLeft : null)
          setTrialText(typeof d?.trialText === "string" ? d.trialText : null)

          const accessActive =
            Boolean(d?.hasAccess) ||
            Boolean(d?.unlimited) ||
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

s2, n = pat.subn(replacement, s, count=1)
if n == 0:
    print("⚠️ Не нашёл useEffect(loadSummary). Пропускаю замену refresh-listener.")
else:
    s = s2

# 5) Чистим дублирующееся выражение в бейдже Trial/Access
s = s.replace(
    '{trialText ? `Access: ${trialText}` : hasAccess ? "Access: Active" : trialText ? `Access: ${trialText}` : `Trial left: ${trialLeft}`}',
    '{trialText ? `Access: ${trialText}` : hasAccess ? "Access: Active" : `Trial left: ${trialLeft}`}'
)

p.write_text(s, "utf-8")
print("✅ header.tsx fixed: syntax + refresh logic + logout logic")
