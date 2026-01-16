from pathlib import Path
import re

p = Path("app/api/account/summary/route.ts")
s = p.read_text("utf-8")

s2, n = re.subn(
    r'trialText:\s*promoActive\s*\?\s*"Doctor access"\s*:\s*paidActive\s*\?\s*"Unlimited"\s*:\s*String\(trialLeft\)',
    'trialText: promoActive ? "Doctor access" : paidActive ? "Unlimited" : null',
    s,
    count=1,
    flags=re.M,
)

if n == 0:
    # fallback если формат чуть другой
    s2 = s.replace(
        'trialText: promoActive ? "Doctor access" : paidActive ? "Unlimited" : String(trialLeft),',
        'trialText: promoActive ? "Doctor access" : paidActive ? "Unlimited" : null,'
    )

p.write_text(s2, "utf-8")
print("✅ account/summary patched: trialText only for unlimited access")
