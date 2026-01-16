from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# 1) Проверяем что есть window.fetch override
if "window.fetch" not in s:
    raise SystemExit("❌ header.tsx: не найден window.fetch override (его нет в файле).")

# 2) Добавим логику 402 -> sessionStorage flag, чтобы PaywallToast точно открылся
# Ищем точку, где проверяется res.status === 402
if 'sessionStorage.setItem("turbota_paywall"' not in s:
    s2, n = re.subn(
        r'(if\s*\(\s*res\.status\s*===\s*402\s*\)\s*\{\s*)',
        r'\1try { sessionStorage.setItem("turbota_paywall","trial") } catch {}\n',
        s,
        count=1
    )
    s = s2
    if n == 0:
        print("⚠️ Не нашёл if (res.status === 402) — возможно у тебя по-другому написано. Пропускаю 402 sessionStorage patch.")
    else:
        print("✅ header.tsx: добавил sessionStorage.setItem('turbota_paywall','trial') перед редиректом")

# 3) Вставим refresh хуки внутрь try {} где вычисляется url
# Нужно вставить блоки после строки где определяется url (const url = ...)
if 'url.includes("/api/auth/clear")' not in s or 'url.includes("/api/billing/promo/redeem")' not in s:
    m_url = re.search(r'const\s+url\s*=\s*[\s\S]*?\n', s)
    if not m_url:
        # fallback: вставим сразу после try {
        m_try = re.search(r'try\s*\{\s*\n', s)
        if not m_try:
            raise SystemExit("❌ header.tsx: не нашёл try { внутри fetch override")
        insert_at = m_try.end()
    else:
        insert_at = m_url.end()

    inject = ""
    if 'url.includes("/api/auth/clear")' not in s:
        inject += """
        if (url.includes("/api/auth/clear")) {
          if (res.ok) {
            // важно: чистим клиентский supabase localStorage токен, иначе UI может думать что ты залогинен
            try {
              for (const k of Object.keys(localStorage)) {
                if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
                  localStorage.removeItem(k)
                }
              }
            } catch {}
            window.dispatchEvent(new Event("turbota:refresh"))
          }
        }
"""

    if 'url.includes("/api/billing/promo/redeem")' not in s:
        inject += """
        if (url.includes("/api/billing/promo/redeem")) {
          if (res.ok) {
            window.dispatchEvent(new Event("turbota:refresh"))
          }
        }
"""

    if inject.strip():
        s = s[:insert_at] + inject + s[insert_at:]
        print("✅ header.tsx: добавил refresh хуки для /api/auth/clear и /api/billing/promo/redeem")
    else:
        print("✅ header.tsx: refresh хуки уже есть")

# 4) Обновление состояния доступа на основе /api/account/summary
# Ищем где стоит setTrialLeft(...) — после этого докинем setHasAccess/setTrialText если их нет
if "setTrialLeft(" in s and ("setHasAccess(" in s or "setTrialText(" in s):
    # возможно уже есть — проверим, не дублируя
    pass

if "setTrialLeft(" in s and "Doctor access" not in s:
    # вставим после первой setTrialLeft(...)
    def repl(m):
        line = m.group(0)
        return line + """
        setHasAccess(data?.access === "Paid" || data?.access === "Promo")
        setTrialText(data?.access === "Paid" ? "Unlimited" : data?.access === "Promo" ? "Doctor access" : null)
"""
    s2, n = re.subn(r'^\s*setTrialLeft\([^\n]+\)\s*;?\s*$', repl, s, count=1, flags=re.M)
    if n > 0:
        s = s2
        print("✅ header.tsx: добавил setHasAccess/setTrialText по data.access")
    else:
        print("⚠️ header.tsx: не смог вставить setHasAccess/setTrialText (не нашёл setTrialLeft строкой)")

p.write_text(s, "utf-8")
print("✅ header.tsx patched OK")
