from pathlib import Path
import re

p = Path("components/video-call-dialog.tsx")
s = p.read_text("utf-8")

needle = "/api/turbotaai-agent"
pos = s.find(needle)
if pos == -1:
    raise SystemExit("❌ Не нашёл '/api/turbotaai-agent' в components/video-call-dialog.tsx")

# найдём ближайший await fetch( ) после needle
fetch_pos = s.find("await fetch", pos)
if fetch_pos == -1:
    raise SystemExit("❌ Не нашёл 'await fetch' после '/api/turbotaai-agent'")

# найдём конец fetch-выражения по первому ');' после await fetch
end = s.find(");", fetch_pos)
if end == -1:
    raise SystemExit("❌ Не нашёл закрытие fetch ');'")

# попробуем найти имя переменной ответа: const X = await fetch(
chunk_start = max(0, fetch_pos - 300)
chunk = s[chunk_start:fetch_pos + 80]
m = re.search(r"const\s+(\w+)\s*=\s*await\s+fetch\s*\(", chunk, flags=re.M)

resp_var = m.group(1) if m else None
if not resp_var:
    # fallback - иногда это let/var
    m2 = re.search(r"(let|var)\s+(\w+)\s*=\s*await\s+fetch\s*\(", chunk, flags=re.M)
    resp_var = m2.group(2) if m2 else None

if not resp_var:
    raise SystemExit("❌ Не смог определить переменную ответа fetch. Дай мне первые 120 строк файла и я перепишу целиком.")

inject = f"""

    // paywall + realtime counter refresh
    if ({resp_var}.status === 402) {{
      window.dispatchEvent(new Event("turbota:refresh"))
      router.push("/pricing?paywall=trial")
      return
    }}

    if ({resp_var}.ok) {{
      window.dispatchEvent(new Event("turbota:refresh"))
    }}
"""

# не дублируем
if "status === 402" in s and "turbota:refresh" in s:
    print("✅ video-call-dialog уже пропатчен")
    raise SystemExit(0)

insert_at = end + 2
s2 = s[:insert_at] + inject + s[insert_at:]

p.write_text(s2, "utf-8")
print("✅ Patched video-call-dialog: 402 -> redirect pricing + refresh header")
