from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

if "/api/billing/promo/redeem" in s:
    print("✅ header.tsx already handles promo redeem refresh")
    raise SystemExit(0)

needle = 'if (url.includes("/api/turbotaai-agent")) {'
pos = s.find(needle)
if pos == -1:
    raise SystemExit('❌ Could not find turbotaai-agent fetch hook in header.tsx')

insert_pos = s.find("}", pos)
if insert_pos == -1:
    raise SystemExit("❌ Could not find end of turbota block")

inject = """

        if (url.includes("/api/billing/promo/redeem")) {
          if (res.ok) {
            window.dispatchEvent(new Event("turbota:refresh"))
          }
        }
"""

s = s[:insert_pos+1] + inject + s[insert_pos+1:]
p.write_text(s, "utf-8")
print("✅ header.tsx patched: promo redeem triggers turbota:refresh")
