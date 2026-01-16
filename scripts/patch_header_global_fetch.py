from pathlib import Path
import re

p = Path("components/header.tsx")
if not p.exists():
    raise SystemExit("❌ components/header.tsx not found")

s = p.read_text("utf-8")

# уже есть перехват
if "turbota_global_fetch_interceptor" in s:
    print("✅ header already has global fetch interceptor")
    raise SystemExit(0)

inject = """
  // turbota_global_fetch_interceptor
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch.bind(window)

    window.fetch = (async (input: any, init?: any) => {
      const res = await originalFetch(input, init)

      try {
        const url =
          typeof input === "string"
            ? input
            : input?.url
            ? String(input.url)
            : ""

        if (url.includes("/api/turbotaai-agent")) {
          if (res.status === 402) {
            window.dispatchEvent(new Event("turbota:refresh"))
            window.location.assign("/pricing?paywall=trial")
          } else if (res.ok) {
            window.dispatchEvent(new Event("turbota:refresh"))
          }
        }
      } catch {}

      return res
    }) as any

    return () => {
      window.fetch = originalFetch as any
    }
  }, [])
"""

# вставим перед первым "return (" внутри компонента
pos = s.find("return (")
if pos == -1:
    raise SystemExit("❌ Could not find 'return (' in header.tsx")

# чтобы вставить ровно внутри компонента, найдём ближайший перенос строки перед return
line_start = s.rfind("\n", 0, pos) + 1
indent = re.match(r"[ \t]*", s[line_start:]).group(0)

s = s[:line_start] + inject.replace("\n", "\n" + indent) + "\n" + s[line_start:]

p.write_text(s, "utf-8")
print("✅ header patched: global paywall redirect + realtime refresh")
