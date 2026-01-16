from pathlib import Path
import re

p = Path("components/paywall-toast.tsx")
if not p.exists():
    raise SystemExit("❌ components/paywall-toast.tsx не найден")

s = p.read_text("utf-8")

# Добавим чтение sessionStorage, если ещё нет
if "turbota_paywall" not in s:
    s = re.sub(
        r"useEffect\(\(\)\s*=>\s*\{\s*([\s\S]*?)\}\s*,\s*\[\s*pathname\s*,\s*paywall\s*\]\s*\)\s*",
        """useEffect(() => {
    let forced = false
    try {
      forced = sessionStorage.getItem("turbota_paywall") === "trial"
    } catch {}

    if ((pathname === "/pricing" && paywall === "trial") || forced) {
      setOpen(true)
      try { sessionStorage.removeItem("turbota_paywall") } catch {}
    }
  }, [pathname, paywall])
""",
        s,
        count=1
    )

p.write_text(s, "utf-8")
print("✅ paywall-toast.tsx patched: opens by query OR sessionStorage flag")
