from pathlib import Path
import re

p = Path("components/video-call-dialog.tsx")
if not p.exists():
    raise SystemExit("❌ components/video-call-dialog.tsx not found")

s = p.read_text("utf-8")

if "/api/turbotaai-agent" not in s:
    raise SystemExit("❌ Endpoint /api/turbotaai-agent not found in file")

# уже пропатчено
if "status === 402" in s and "turbota:refresh" in s:
    print("✅ video-call-dialog already patched")
    raise SystemExit(0)

# 1) ищем endpoint-литерал и переменную endpoint
endpoint_vars = []
for m in re.finditer(r'const\s+(\w+)\s*=\s*["\']\/api\/turbotaai-agent["\']\s*;?', s):
    endpoint_vars.append(m.group(1))

# 2) ищем fetch вызов:
# A) await fetch("/api/turbotaai-agent", ...)
m = re.search(r'await\s+fetch\s*\(\s*["\']\/api\/turbotaai-agent["\']\s*,', s)
fetch_pos = m.start() if m else -1

# B) await fetch(endpointVar, ...)
if fetch_pos == -1 and endpoint_vars:
    for v in endpoint_vars:
        m2 = re.search(rf'await\s+fetch\s*\(\s*{re.escape(v)}\s*,', s)
        if m2:
            fetch_pos = m2.start()
            break

# C) fetch("/api/turbotaai-agent", ...) (без await в этой точке) — тоже ловим
if fetch_pos == -1:
    m3 = re.search(r'fetch\s*\(\s*["\']\/api\/turbotaai-agent["\']\s*,', s)
    fetch_pos = m3.start() if m3 else -1

if fetch_pos == -1 and endpoint_vars:
    for v in endpoint_vars:
        m4 = re.search(rf'fetch\s*\(\s*{re.escape(v)}\s*,', s)
        if m4:
            fetch_pos = m4.start()
            break

if fetch_pos == -1:
    raise SystemExit("❌ Не смог найти fetch(...) на /api/turbotaai-agent")

# 3) находим начало statement (строка где fetch)
stmt_start = s.rfind("\n", 0, fetch_pos) + 1
indent = re.match(r"[ \t]*", s[stmt_start:]).group(0)

# 4) выясняем, есть ли переменная ответа: const X = await fetch(
stmt_line = s[stmt_start: s.find("\n", stmt_start)]
mvar = re.search(r"(const|let|var)\s+(\w+)\s*=\s*await\s+fetch\s*\(", stmt_line)
resp_var = None

if mvar:
    resp_var = mvar.group(2)
else:
    # возможно перенос строки: const r = await fetch(
    stmt_block = s[stmt_start: stmt_start + 400]
    mvar2 = re.search(r"(const|let|var)\s+(\w+)\s*=\s*await\s+fetch\s*\(", stmt_block)
    if mvar2:
        resp_var = mvar2.group(2)

# 5) если переменной нет — превращаем statement в: const __turbotaRes = await fetch(...)
# только если там реально await fetch...
if resp_var is None:
    # найдём "await fetch(" после stmt_start
    aw = s.find("await fetch", stmt_start, stmt_start + 800)
    if aw == -1:
        # если fetch без await — не трогаем (это сложно и рискованно)
        raise SystemExit('❌ fetch найден без await. Дай: sed -n "1,220p components/video-call-dialog.tsx"')
    # вставим "const __turbotaRes = " перед await fetch
    s = s[:aw] + "const __turbotaRes = " + s[aw:]
    resp_var = "__turbotaRes"
    print("✅ Added response variable const __turbotaRes = await fetch(...)")

# 6) найдём конец statement после fetch (до ; или до конца выражения)
# делаем парсинг до первого ; на нулевой глубине
i = stmt_start
depth_round = depth_curly = depth_sq = 0
in_str = None
esc = False
seen_fetch = False
end_stmt = None

while i < len(s):
    ch = s[i]

    if in_str:
        if esc:
            esc = False
        elif ch == "\\":
            esc = True
        elif ch == in_str:
            in_str = None
        i += 1
        continue

    if ch in ("'", '"', "`"):
        in_str = ch
        i += 1
        continue

    if s.startswith("fetch", i):
        seen_fetch = True

    if ch == "(":
        depth_round += 1
    elif ch == ")":
        depth_round = max(0, depth_round - 1)
    elif ch == "{":
        depth_curly += 1
    elif ch == "}":
        depth_curly = max(0, depth_curly - 1)
    elif ch == "[":
        depth_sq += 1
    elif ch == "]":
        depth_sq = max(0, depth_sq - 1)

    # конец выражения
    if seen_fetch and depth_round == 0 and depth_curly == 0 and depth_sq == 0:
        if ch == ";":
            end_stmt = i + 1
            break
        # если нет ; — конец строки тоже допустим
        if ch == "\n":
            end_stmt = i + 1
            break

    i += 1

if end_stmt is None:
    # fallback — вставим сразу после строки
    end_stmt = s.find("\n", stmt_start)
    if end_stmt == -1:
        end_stmt = len(s)
    else:
        end_stmt += 1

inject = f"""
{indent}// paywall + realtime counter refresh
{indent}if ({resp_var}.status === 402) {{
{indent}  window.dispatchEvent(new Event("turbota:refresh"))
{indent}  window.location.assign("/pricing?paywall=trial")
{indent}  return
{indent}}}
{indent}if ({resp_var}.ok) {{
{indent}  window.dispatchEvent(new Event("turbota:refresh"))
{indent}}}
"""

s = s[:end_stmt] + inject + s[end_stmt:]

# гарантируем use client
if not s.lstrip().startswith('"use client"') and not s.lstrip().startswith("'use client'"):
    s = '"use client"\n\n' + s

p.write_text(s, "utf-8")
print("✅ video-call-dialog patched: 402 -> redirect + refresh")
