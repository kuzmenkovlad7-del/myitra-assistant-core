from pathlib import Path
import re

def ensure_named_import(code: str, module: str, name: str) -> str:
    # import { a, b } from "module"
    pat = re.compile(rf'(^\s*import\s*\{{)([^}}]+)(\}}\s*from\s*["\']{re.escape(module)}["\']\s*;?\s*$)', re.M)
    m = pat.search(code)
    if m:
        left, names, right = m.group(1), m.group(2), m.group(3)
        parts = [x.strip() for x in names.split(",") if x.strip()]
        if name in parts:
            return code
        parts.append(name)
        new_names = ", ".join(parts)
        return code[:m.start()] + f'{left} {new_names} {right}' + code[m.end():]

    # import X from "module" -> add new named import отдельно
    ins = f'import {{ {name} }} from "{module}"\n'
    # после "use client" если есть
    if code.lstrip().startswith('"use client"') or code.lstrip().startswith("'use client'"):
        idx = code.find("\n")
        return code[:idx+1] + "\n" + ins + code[idx+1:]
    return ins + code

def ensure_import_line(code: str, line: str) -> str:
    if line in code:
        return code
    # вставим после "use client" или сверху
    if code.lstrip().startswith('"use client"') or code.lstrip().startswith("'use client'"):
        i = code.find("\n")
        return code[:i+1] + "\n" + line + "\n" + code[i+1:]
    return line + "\n" + code

def patch_header():
    p = Path("components/header.tsx")
    s = p.read_text("utf-8")

    # 1) Banner import
    s = ensure_import_line(s, 'import { Banner } from "@/components/ui/banner"')

    # 2) useSearchParams должен быть
    s = ensure_named_import(s, "next/navigation", "useSearchParams")

    # 3) trialText state (если нет)
    if "const [trialText, setTrialText]" not in s:
        s = s.replace(
            "const [trialLeft, setTrialLeft] = useState<number | null>(null)",
            "const [trialLeft, setTrialLeft] = useState<number | null>(null)\n  const [trialText, setTrialText] = useState<string | null>(null)",
            1
        )

    # 4) showPaywall state
    if "const [showPaywall" not in s:
        # вставим рядом с trialText
        s = s.replace(
            "const [trialText, setTrialText] = useState<string | null>(null)",
            "const [trialText, setTrialText] = useState<string | null>(null)\n  const [showPaywall, setShowPaywall] = useState(false)",
            1
        )

    # 5) searchParams + paywall
    if "const searchParams = useSearchParams()" not in s:
        # вставим в начало компонента после первых useState
        m = re.search(r"(function\s+Header[^{]*\{\s*)", s)
        if m:
            insert = m.end()
            s = s[:insert] + "\n  const searchParams = useSearchParams()\n" + s[insert:]
    if "const paywall" not in s:
        s = s.replace(
            "const searchParams = useSearchParams()",
            "const searchParams = useSearchParams()\n  const paywall = searchParams?.get(\"paywall\")",
            1
        )

    # 6) useEffect: showPaywall when ?paywall=trial
    if "setShowPaywall(paywall ===" not in s:
        # вставим после объявления paywall
        s = s.replace(
            "const paywall = searchParams?.get(\"paywall\")",
            "const paywall = searchParams?.get(\"paywall\")\n\n  useEffect(() => {\n    setShowPaywall(paywall === \"trial\")\n  }, [paywall])",
            1
        )

    # 7) setTrialText from /api/account/summary response
    if "setTrialText(" not in s and 'fetch("/api/account/summary")' in s:
        s = s.replace(
            "setTrialLeft(typeof d?.trialLeft === \"number\" ? d.trialLeft : null)",
            "setTrialLeft(typeof d?.trialLeft === \"number\" ? d.trialLeft : null)\n        setTrialText(typeof d?.trialText === \"string\" ? d.trialText : null)",
            1
        )

    # 8) Header display: if trialText exists -> show Access text
    s = s.replace(
        "`Trial left: ${trialLeft}`",
        'trialText ? `Access: ${trialText}` : `Trial left: ${trialLeft}`'
    )

    # 9) В глобальном fetch-перехвате добавим /api/billing/promo/redeem чтобы сразу обновлялся Header
    # Если у тебя уже есть блок url.includes("/api/turbotaai-agent"), просто расширяем условие
    s = s.replace(
        'if (url.includes("/api/turbotaai-agent")) {',
        'if (url.includes("/api/turbotaai-agent") || url.includes("/api/billing/promo/redeem")) {'
    )

    # 10) Добавим paywall Banner прямо внутри <header ...>
    # Вставим сразу после первого <header ...>
    if "Free trial is over" not in s:
        m = re.search(r"(<header[^>]*>)", s)
        if m:
            insert_at = m.end()
            banner_jsx = """
        {showPaywall ? (
          <div className="fixed right-4 top-4 z-[9999] w-[360px]">
            <Banner
              show={true}
              variant="warning"
              showShade={true}
              closable={true}
              title="Free trial is over"
              description="Subscribe to continue using the assistant."
              onHide={() => {
                setShowPaywall(false)
                try {
                  const u = new URL(window.location.href)
                  u.searchParams.delete("paywall")
                  const next = u.pathname + (u.search ? u.search : "")
                  window.history.replaceState({}, "", next)
                } catch {}
              }}
            />
          </div>
        ) : null}
"""
            s = s[:insert_at] + banner_jsx + s[insert_at:]

    p.write_text(s, "utf-8")
    print("✅ header.tsx patched: paywall banner + access label + promo refresh")

def patch_profile():
    p = Path("app/profile/page.tsx")
    s = p.read_text("utf-8")

    # 1) label Trial left -> Access when unlimited
    s = re.sub(
        r'(<span[^>]*text-slate-500[^>]*>)\s*Trial left:\s*(</span>)',
        r'\1{s?.unlimited ? "Access:" : "Trial left:"}\2',
        s,
        count=1,
        flags=re.M
    )

    # 2) value for trialLeft -> show trialText when unlimited
    s = s.replace(
        'typeof s?.trialLeft === "number" ? s?.trialLeft : 0',
        '(s?.unlimited ? (s?.trialText ?? (s?.access === "Paid" ? "Unlimited" : "Doctor access")) : (typeof s?.trialLeft === "number" ? s?.trialLeft : 0))'
    )

    p.write_text(s, "utf-8")
    print("✅ profile/page.tsx patched: access label for promo/paid")

def main():
    patch_header()
    patch_profile()

if __name__ == "__main__":
    main()
