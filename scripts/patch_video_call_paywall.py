from pathlib import Path
import re

p = Path("components/video-call-dialog.tsx")
s = p.read_text("utf-8")

if "/pricing?paywall=trial" in s and "turbota:refresh" in s:
    print("✅ video-call-dialog already patched")
    raise SystemExit(0)

# --- 1) ensure useRouter import exists ---
nav_import = re.search(r'import\s*{\s*([^}]+)\s*}\s*from\s*"next/navigation"\s*;?', s)
if nav_import:
    names = [x.strip() for x in nav_import.group(1).split(",") if x.strip()]
    if "useRouter" not in names:
        names.append("useRouter")
        new_line = f'import {{ {", ".join(names)} }} from "next/navigation"'
        s = s[:nav_import.start()] + new_line + s[nav_import.end():]
else:
    # если вообще нет импорта next/navigation — добавим сверху
    s = 'import { useRouter } from "next/navigation"\n' + s

# --- 2) ensure router const ---
if "const router = useRouter()" not in s:
    s = re.sub(
        r"(export default function[^{]*{\s*)",
        r"\1  const router = useRouter()\n",
        s,
        count=1,
        flags=re.M,
    )

# --- 3) find the fetch response variable ---
resp_var = None
insert_pos = None

# case A: fetch call contains turbotaai-agent directly
m = re.search(
    r"const\s+(\w+)\s*=\s*await\s+fetch\([\s\S]*?turbotaai-agent[\s\S]*?\)\s*;",
    s,
    flags=re.M,
)
if m:
    resp_var = m.group(1)
    insert_pos = m.end()
else:
    # case B: endpoint stored in variable
    m2 = re.search(r'const\s+(\w+)\s*=\s*["\']\/api\/turbotaai-agent["\']\s*;', s, flags=re.M)
    if m2:
        endpoint_var = m2.group(1)
        m3 = re.search(
            rf"const\s+(\w+)\s*=\s*await\s+fetch\(\s*{re.escape(endpoint_var)}\s*,[\s\S]*?\)\s*;",
            s,
            flags=re.M,
        )
        if m3:
            resp_var = m3.group(1)
            insert_pos = m3.end()

if not resp_var or not insert_pos:
    raise SystemExit('❌ Не смог найти fetch вызов для /api/turbotaai-agent. Покажи "sed -n 1,140p components/video-call-dialog.tsx" и я перепишу файл целиком.')

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

# вставляем только если еще нет
if "status === 402" not in s:
    s = s[:insert_pos] + inject + s[insert_pos:]

p.write_text(s, "utf-8")
print("✅ video-call-dialog patched: 402 redirect + refresh event")
