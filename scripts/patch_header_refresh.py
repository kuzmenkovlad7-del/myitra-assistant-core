from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

if "turbota:refresh" in s:
    print("✅ Header already listens turbota:refresh")
    raise SystemExit(0)

# Найдём useEffect, где fetch("/api/account/summary")
if 'fetch("/api/account/summary")' not in s:
    raise SystemExit("❌ Не нашёл fetch('/api/account/summary') в components/header.tsx")

# Вынесем загрузку в функцию loadSummary + подписка на событие
s = s.replace(
    'useEffect(() => {\n    fetch("/api/account/summary")',
    'const loadSummary = () =>\n    fetch("/api/account/summary")\n\n  useEffect(() => {\n    loadSummary()',
    1
)

# добавить then/catch не трогаем, просто в конце эффекта добавим listener
# вставим перед закрывающим "}, [])"
s = re.sub(
    r"\},\s*\[\]\s*\)",
    r"""    const onRefresh = () => loadSummary()
    window.addEventListener("turbota:refresh", onRefresh)
    return () => window.removeEventListener("turbota:refresh", onRefresh)
  }, [])""",
    s,
    count=1,
    flags=re.M,
)

p.write_text(s, "utf-8")
print("✅ Header patched: listens turbota:refresh and reloads summary")
