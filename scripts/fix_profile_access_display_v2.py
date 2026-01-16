from pathlib import Path
import re

p = Path("app/profile/page.tsx")
s = p.read_text("utf-8")

# заменяем s?.unlimited на проверку access
s = s.replace("s?.unlimited", '(s?.access === "Paid" || s?.access === "Promo")')

# если внутри значения было trialText/unlimited — делаем нормальный вывод
# Пробуем заменить общий кейс Trial left value
s = re.sub(
    r'\(s\?\.(?:access\s*===\s*"Paid"\s*\?\s*"Unlimited"\s*:\s*"Doctor access"|trialText[^\)]*)\)',
    '(s?.access === "Paid" ? "Unlimited" : "Doctor access")',
    s
)

p.write_text(s, "utf-8")
print("✅ profile/page.tsx fixed: access display uses access field")
