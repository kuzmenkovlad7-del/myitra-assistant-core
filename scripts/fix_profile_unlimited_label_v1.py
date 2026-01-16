from pathlib import Path
import re

p = Path("app/profile/page.tsx")
s = p.read_text("utf-8")

# 1) убрать строку "Access: {s?.access}" если она есть (дублирует)
s = re.sub(
    r'^[ \t]*<div[^>]*>\s*Access:\s*\{s\?\.(?:access|status)[^}]*\}\s*</div>\s*\n',
    '',
    s,
    flags=re.M
)

# 2) Trial left -> Access/Trial left (по access)
s = s.replace(
    '"Trial left:"',
    '(s?.access === "Paid" || s?.access === "Promo") ? "Access:" : "Trial left:"'
)

# 3) значение Trial left: если Promo/Paid -> Unlimited/Doctor access
s = s.replace(
    'typeof s?.trialLeft === "number" ? s?.trialLeft : 0',
    '(s?.access === "Paid" ? "Unlimited" : s?.access === "Promo" ? "Doctor access" : (typeof s?.trialLeft === "number" ? s?.trialLeft : 0))'
)

p.write_text(s, "utf-8")
print("✅ profile fixed: shows Unlimited/Doctor access instead of 0 when promo/paid")
