from pathlib import Path
import re

candidates = [
    Path("app/api/account/summary/route.ts"),
    Path("app/api/account/summary/route.tsx"),
]

target = None
for c in candidates:
    if c.exists():
        target = c
        break

if not target:
    raise SystemExit("❌ Не найден app/api/account/summary/route.ts (проверь путь)")

s = target.read_text("utf-8")

# paid/promo активны только если есть user
s = re.sub(
    r"const\s+paidActive\s*=\s*isActiveDate\(paidUntil\)\s*",
    "const paidActive = !!user && isActiveDate(paidUntil)\n",
    s
)
s = re.sub(
    r"const\s+promoActive\s*=\s*isActiveDate\(promoUntil\)\s*",
    "const promoActive = !!user && isActiveDate(promoUntil)\n",
    s
)

# добавим hasAccess в ответ, чтобы фронт мог читать единообразно
if "hasAccess" not in s:
    s = s.replace(
        "unlimited,",
        "unlimited,\n    hasAccess: unlimited,\n"
    )

target.write_text(s, "utf-8")
print(f"✅ patched: {target} (promo/paid only when logged-in + hasAccess)")
