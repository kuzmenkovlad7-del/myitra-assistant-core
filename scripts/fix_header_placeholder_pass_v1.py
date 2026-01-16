from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# 1) удаляем питоновский плейсхолдер (строго по твоему куску)
pat = re.compile(
    r'if\s*\(\(isAgent\s*\|\|\s*isPromo\s*\|\|\s*isClear\)\s*&&\s*res\.ok\)\s*:\s*#.*?\n\s*pass\s*\n',
    re.M
)

replacement = """if ((isAgent || isPromo || isClear) && res.ok) {
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
        }
"""

s2, n = pat.subn(replacement, s, count=1)
if n == 0:
    raise SystemExit("❌ Не нашёл плейсхолдер с ': # placeholder' и 'pass' в header.tsx")

p.write_text(s2, "utf-8")
print("✅ header.tsx fixed: removed python placeholder + inserted TS block")
