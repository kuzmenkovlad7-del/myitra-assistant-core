from pathlib import Path
import re

def read(p: Path) -> str:
    return p.read_text("utf-8")

def write(p: Path, s: str):
    p.write_text(s, "utf-8")

def cleanup_import_braces(s: str) -> str:
    # чистим ", ,", "{ ,", ", }" в import
    s = re.sub(r"\{\s*,", "{", s)
    s = re.sub(r",\s*,", ", ", s)
    s = re.sub(r",\s*}", " }", s)
    s = re.sub(r"\{\s*\}", "{}", s)
    return s

def ensure_use_client(s: str) -> str:
    if s.lstrip().startswith('"use client"') or s.lstrip().startswith("'use client'"):
        return s
    # вставим сверху
    return '"use client"\n\n' + s

def fix_pricing_compile():
    p = Path("app/pricing/page.tsx")
    if not p.exists():
        print("⚠️ app/pricing/page.tsx not found, skipping")
        return

    s = read(p)

    # 1) убираем экранирование \" которое у тебя реально в файле (оно не нужно в tsx)
    s = s.replace('\\"', '"')

    # 2) вычищаем useSearchParams/paywall, чтобы не ломало компиляцию
    s = re.sub(r'^\s*const\s+searchParams\s*=\s*useSearchParams\(\)\s*;?\s*$', "", s, flags=re.M)
    s = re.sub(r'^\s*const\s+paywall\s*=.*$', "", s, flags=re.M)

    # 3) вычищаем импорт useSearchParams
    s = re.sub(r"\buseSearchParams\s*,\s*", "", s)
    s = re.sub(r",\s*useSearchParams\b", "", s)
    s = re.sub(r"\buseSearchParams\b", "", s)

    # 4) убираем мусорные </> которые попали рядом с useRouter
    s = re.sub(r"const\s+router\s*=\s*useRouter\([\s\S]*?\)\s*;", "const router = useRouter();", s, count=1)

    # 5) если была обёртка return ( <> ... </> ); — аккуратно убираем
    s = s.replace("return (\n    <>", "return (")
    s = re.sub(r"</>\s*\n\s*\);\s*$", ");", s, flags=re.M)

    # 6) вырезаем старый блок paywall баннера если он остался
    s = re.sub(r'\{paywall\s*===\s*["\']trial["\'][\s\S]*?\}\s*:\s*null\}\s*', "", s, flags=re.M)

    # 7) RainbowButton: добавляем id="turbota-subscribe" на первую радужную кнопку (обычно Subscribe)
    if "<RainbowButton" in s and 'id="turbota-subscribe"' not in s:
        s = re.sub(r"<RainbowButton(?![^>]*\bid=)([^>]*)>", r'<RainbowButton id="turbota-subscribe"\1>', s, count=1)

    s = cleanup_import_braces(s)
    write(p, s)
    print("✅ pricing page fixed (compile clean) + subscribe id added")

def patch_header_paywall_banner():
    p = Path("components/header.tsx")
    if not p.exists():
        print("⚠️ components/header.tsx not found, skipping")
        return

    s = read(p)
    s = ensure_use_client(s)

    # 1) добавить импорты Banner/RainbowButton/Button если нет
    if 'from "@/components/ui/banner"' not in s:
        s = s.replace("\n", '\nimport { Banner } from "@/components/ui/banner"\n', 1)

    if 'from "@/components/ui/rainbow-button"' not in s:
        s = s.replace("\n", '\nimport { RainbowButton } from "@/components/ui/rainbow-button"\n', 1)

    if 'from "@/components/ui/button"' not in s:
        s = s.replace("\n", '\nimport { Button } from "@/components/ui/button"\n', 1)

    # 2) расширяем import next/navigation
    nav_pat = re.compile(r'import\s*\{([^}]+)\}\s*from\s*"next/navigation"\s*;?', re.M)
    m = nav_pat.search(s)
    need = ["usePathname", "useSearchParams"]
    if m:
        items = [x.strip() for x in m.group(1).split(",") if x.strip()]
        changed = False
        for n in need:
            if n not in items:
                items.append(n)
                changed = True
        if changed:
            new_line = f'import {{ {", ".join(items)} }} from "next/navigation"'
            s = s[:m.start()] + new_line + s[m.end():]
    else:
        # если вообще не было — добавим
        s = s.replace("\n", '\nimport { usePathname, useSearchParams } from "next/navigation"\n', 1)

    # 3) fetch summary сделать no-store + include (чтобы не кешировало и куки точно шли)
    # чинит "не уменьшается Trial left в хедере"
    s = re.sub(
        r'fetch\(\s*"/api/account/summary"\s*\)',
        'fetch("/api/account/summary", { cache: "no-store", credentials: "include" })',
        s
    )

    # 4) добавим вычисление showPaywall + dismissed (без useEffect)
    if "const showPaywall" not in s:
        anchor = 'const [trialLeft, setTrialLeft]'
        idx = s.find(anchor)
        if idx != -1:
            # вставим сразу после блока useState trialLeft/trialText
            insert_at = s.find("\n", idx)
            injected = """
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const paywall = searchParams?.get("paywall")
  const [paywallDismissed, setPaywallDismissed] = useState(false)
  const showPaywall = pathname === "/pricing" && paywall === "trial" && !paywallDismissed
"""
            s = s[:insert_at+1] + injected + s[insert_at+1:]
        else:
            # fallback: вставим возле начала компонента
            s = re.sub(r"(function\s+Header[^{]*\{\s*)", r"\1\n" + """
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const paywall = searchParams?.get("paywall")
  const [paywallDismissed, setPaywallDismissed] = useState(false)
  const showPaywall = pathname === "/pricing" && paywall === "trial" && !paywallDismissed
""", s, count=1)

    # 5) вставим JSX баннера внутрь <header ...> сразу после открытия
    if "<Banner" not in s or "Free trial is over" not in s:
        header_open = re.search(r"<header[^>]*>", s)
        if header_open:
            insert_pos = header_open.end()
            banner_jsx = r"""
      {showPaywall ? (
        <div className="fixed right-4 top-4 z-[9999] w-[380px]">
          <Banner
            show={true}
            variant="warning"
            showShade={true}
            closable={true}
            onHide={() => setPaywallDismissed(true)}
            title="Free trial is over"
            description="Subscribe to continue using the assistant."
            action={
              <div className="flex items-center gap-2">
                <RainbowButton
                  className="h-9 px-4 text-sm font-semibold"
                  onClick={() => {
                    const btn = document.getElementById("turbota-subscribe") as HTMLButtonElement | null
                    if (btn) btn.click()
                    else window.location.assign("/pricing")
                  }}
                >
                  Subscribe
                </RainbowButton>
                <Button
                  variant="outline"
                  className="h-9 px-4"
                  onClick={() => setPaywallDismissed(true)}
                >
                  Later
                </Button>
              </div>
            }
          />
        </div>
      ) : null}
"""
            s = s[:insert_pos] + banner_jsx + s[insert_pos:]
        else:
            print("⚠️ header root <header> not found, banner not injected")

    s = cleanup_import_braces(s)
    write(p, s)
    print("✅ header patched: paywall banner + no-store summary fetch")

def patch_all_agent_clients():
    # патчим ВСЕ места где дергается /api/turbotaai-agent (чат/голос/видео)
    root = Path(".")
    targets = []

    for p in list(root.rglob("*.tsx")):
        # пропускаем серверные роуты
        if "app/api/" in str(p).replace("\\", "/"):
            continue
        s = read(p)
        if "/api/turbotaai-agent" in s:
            targets.append(p)

    if not targets:
        print("⚠️ No client files with /api/turbotaai-agent found")
        return

    for p in targets:
        s = read(p)

        if "turbota:refresh" in s and "status === 402" in s:
            continue

        # гарантируем client (раз используем window)
        s = ensure_use_client(s)

        # ищем переменную ответа: const X = await fetch(...)
        # 1) сначала ищем fetch("/api/turbotaai-agent"...)
        fetch_pos = s.find("/api/turbotaai-agent")
        window_start = max(0, fetch_pos - 2500)
        window_end = min(len(s), fetch_pos + 2500)
        chunk = s[window_start:window_end]

        m = re.search(r"(const|let|var)\s+(\w+)\s*=\s*await\s+fetch\s*\(", chunk, flags=re.M)
        if not m:
            print(f"⚠️ {p}: can't find 'const r = await fetch(' near endpoint, skipping")
            continue

        resp_var = m.group(2)
        # глобальная позиция начала "await fetch("
        global_m_start = window_start + m.start()
        # ищем "(" после fetch
        paren_start = s.find("(", window_start + m.end() - 1)
        if paren_start == -1:
            print(f"⚠️ {p}: can't locate fetch '('")
            continue

        # парсим скобки до закрывающей ) на нулевой глубине
        depth = 0
        i = paren_start
        in_str = None
        esc = False
        while i < len(s):
            ch = s[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == in_str:
                    in_str = None
            else:
                if ch in ("'", '"', "`"):
                    in_str = ch
                elif ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth == 0:
                        break
            i += 1

        if depth != 0:
            print(f"⚠️ {p}: can't match fetch parentheses")
            continue

        # i = индекс закрывающей ")"
        insert_at = i + 1
        # проглотим ; если он есть
        while insert_at < len(s) and s[insert_at] in " \t\r\n":
            insert_at += 1
        if insert_at < len(s) and s[insert_at] == ";":
            insert_at += 1

        inject = f"""

    // paywall + realtime counter refresh
    if ({resp_var}.status === 402) {{
      window.dispatchEvent(new Event("turbota:refresh"))
      window.location.assign("/pricing?paywall=trial")
      return
    }}
    if ({resp_var}.ok) {{
      window.dispatchEvent(new Event("turbota:refresh"))
    }}
"""
        s = s[:insert_at] + inject + s[insert_at:]
        write(p, s)
        print(f"✅ patched: {p}")

def main():
    fix_pricing_compile()
    patch_header_paywall_banner()
    patch_all_agent_clients()
    print("✅ all done")

if __name__ == "__main__":
    main()
