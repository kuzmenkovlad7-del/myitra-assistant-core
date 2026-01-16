from pathlib import Path
import re

p = Path("app/pricing/page.tsx")
s = p.read_text("utf-8")

# 1) import RainbowButton
if 'from "@/components/ui/rainbow-button"' not in s:
    # вставляем после первых импортов
    m = re.search(r'^(import[^\n]*\n)+', s, flags=re.M)
    if m:
        block = m.group(0)
        if 'RainbowButton' not in block:
            block2 = block + 'import { RainbowButton } from "@/components/ui/rainbow-button"\n'
            s = s.replace(block, block2, 1)

# 2) заменяем PRIMARY кнопку подписки Button -> RainbowButton
# ищем <Button ...> ...Subscribe... </Button> без variant="outline"
btn_pat = re.compile(r"<Button(?P<attrs>[\s\S]*?)>(?P<inner>[\s\S]*?)</Button>", re.M)

def is_outline(attrs: str) -> bool:
    return 'variant="outline"' in attrs or "variant='outline'" in attrs

def is_subscribe(inner: str) -> bool:
    t = re.sub(r"\s+", " ", inner).strip().lower()
    return any(x in t for x in ["subscribe", "подпис", "start", "buy", "get access", "continue"])

out = []
last = 0
replaced = False

for m in btn_pat.finditer(s):
    attrs = m.group("attrs")
    inner = m.group("inner")
    out.append(s[last:m.start()])
    if (not replaced) and (not is_outline(attrs)) and is_subscribe(inner):
        out.append(f"<RainbowButton{attrs}>{inner}</RainbowButton>")
        replaced = True
    else:
        out.append(m.group(0))
    last = m.end()

out.append(s[last:])
s2 = "".join(out)

if not replaced:
    raise SystemExit("❌ Не нашёл кнопку подписки в app/pricing/page.tsx (кидай сюда кусок блока с кнопками, я перепишу точно).")

p.write_text(s2, "utf-8")
print("✅ Pricing patched: primary Subscribe button -> RainbowButton")
