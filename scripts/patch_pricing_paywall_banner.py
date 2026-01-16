from pathlib import Path
import re

p = Path("app/pricing/page.tsx")
s = p.read_text("utf-8")

# imports
need_imports = [
    'import { Banner } from "@/components/ui/banner"',
]

for imp in need_imports:
    if imp not in s:
        m = re.search(r'^(import[^\n]*\n)+', s, flags=re.M)
        if not m:
            raise SystemExit("❌ Не нашёл import блок в pricing/page.tsx")
        block = m.group(0)
        s = s.replace(block, block + imp + "\n", 1)

if "useSearchParams" not in s:
    # добавить useSearchParams в next/navigation
    if 'from "next/navigation"' in s:
        s = s.replace('from "next/navigation"', 'from "next/navigation"', 1)
    else:
        # если нет — добавим новый импорт
        m = re.search(r'^(import[^\n]*\n)+', s, flags=re.M)
        block = m.group(0)
        s = s.replace(block, block + 'import { useSearchParams } from "next/navigation"\n', 1)

# вставим внутри компонента paywall flag
if "const paywall" not in s:
    s = re.sub(
        r"(export default function [^{]+{\s*)",
        r"\1\n  const searchParams = useSearchParams()\n  const paywall = searchParams?.get(\"paywall\")\n",
        s,
        count=1,
        flags=re.M,
    )

# вставим баннер перед основным контентом (после первого return ()
if "paywall === \"trial\"" not in s:
    s = s.replace(
        "return (",
        """return (
    <>
      {paywall === "trial" ? (
        <div className="fixed right-4 top-4 z-[9999] w-[360px]">
          <Banner
            show={true}
            variant="warning"
            showShade={true}
            closable={true}
            title="Free trial is over"
            description="Subscribe to continue using the assistant."
          />
        </div>
      ) : null}
""",
        1,
    )
    # закрыть фрагмент в конце
    s = s.replace(");", "    </>\n  );", 1)

p.write_text(s, "utf-8")
print("✅ Pricing patched: paywall banner added")
