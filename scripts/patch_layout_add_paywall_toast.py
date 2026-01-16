from pathlib import Path

p = Path("app/layout.tsx")
s = p.read_text("utf-8")

if 'from "@/components/paywall-toast"' not in s:
    # вставим импорт рядом с остальными
    idx = s.find('import Header from "@/components/header"')
    if idx == -1:
        raise SystemExit("❌ Could not find Header import in app/layout.tsx")
    s = s[:idx] + 'import { PaywallToast } from "@/components/paywall-toast"\n' + s[idx:]

# вставим <PaywallToast /> перед <Header />
if "<PaywallToast" not in s:
    s = s.replace("<Header />", "<PaywallToast />\n                  <Header />", 1)

p.write_text(s, "utf-8")
print("✅ layout.tsx patched: PaywallToast mounted")
