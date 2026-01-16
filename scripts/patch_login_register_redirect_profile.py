from pathlib import Path
import re

def patch_page(path: str):
    p = Path(path)
    s = p.read_text("utf-8")

    if "router.replace(\"/profile\")" in s or "router.replace('/profile')" in s:
        print(f"✅ {path}: already redirects to /profile")
        return

    # добавим useEffect импорт если надо
    if "useEffect" not in s:
        s = re.sub(r'import\s+\{\s*([^}]+)\s*\}\s+from\s+"react"\s*;?',
                   lambda m: f'import {{ {m.group(1).strip()}, useEffect }} from "react";',
                   s, count=1)

        if "useEffect" not in s:
            # если не было named import react
            s = 'import { useEffect } from "react"\n' + s

    # вставим редирект после router
    m = re.search(r"const\s+router\s*=\s*useRouter\(\)\s*;?", s)
    if not m:
        raise SystemExit(f"❌ {path}: could not find useRouter()")

    insert_at = m.end()

    inject = """

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
        const data = await r.json().catch(() => null)
        if (!alive) return
        if (data?.isLoggedIn) {
          router.replace("/profile")
        }
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [])
"""

    s = s[:insert_at] + inject + s[insert_at:]
    p.write_text(s, "utf-8")
    print(f"✅ {path}: patched redirect to /profile when logged-in")

patch_page("app/login/page.tsx")
patch_page("app/register/page.tsx")
