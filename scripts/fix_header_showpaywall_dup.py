from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# 1) убрать useState showPaywall
s2 = re.sub(
    r'^\s*const\s+\[\s*showPaywall\s*,\s*setShowPaywall\s*\]\s*=\s*useState\([^)]*\)\s*;?\s*\n',
    '',
    s,
    flags=re.M
)
s = s2

# 2) убрать useEffect который делает setShowPaywall(paywall === "trial")
s2 = re.sub(
    r'\n\s*useEffect\(\s*\(\s*\)\s*=>\s*\{\s*\n\s*setShowPaywall\(\s*paywall\s*===\s*["\']trial["\']\s*\)\s*\n\s*\}\s*,\s*\[\s*paywall\s*\]\s*\)\s*;?\s*\n',
    '\n',
    s,
    flags=re.M
)
s = s2

# 3) если в баннере был setShowPaywall(false) -> заменяем на setPaywallDismissed(true)
s = s.replace("setShowPaywall(false)", "setPaywallDismissed(true)")

# 4) если где-то ещё остался setShowPaywall(...) — удаляем строку целиком (на всякий)
s = re.sub(r'^\s*setShowPaywall\([^)]*\)\s*;?\s*\n', '', s, flags=re.M)

p.write_text(s, "utf-8")
print("✅ Fixed header.tsx: removed duplicate showPaywall state + effect")
