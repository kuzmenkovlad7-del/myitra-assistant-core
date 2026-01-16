from pathlib import Path

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# если уже добавлено — ничего не делаем
if 'url.includes("/api/auth/clear")' in s:
    print("✅ header.tsx already refreshes after /api/auth/clear")
    raise SystemExit(0)

needle = 'if (url.includes("/api/turbotaai-agent")) {'
pos = s.find(needle)
if pos == -1:
    raise SystemExit("❌ Could not find turbotaai-agent block in header.tsx")

# вставим рядом с другими url.includes(...)
insert_pos = s.find("}", pos)
if insert_pos == -1:
    raise SystemExit("❌ Could not find end of turbota block")

inject = """

        if (url.includes("/api/auth/clear")) {
          if (res.ok) {
            window.dispatchEvent(new Event("turbota:refresh"))
          }
        }
"""

s = s[:insert_pos+1] + inject + s[insert_pos+1:]
p.write_text(s, "utf-8")
print("✅ header.tsx patched: clear -> turbota:refresh")
