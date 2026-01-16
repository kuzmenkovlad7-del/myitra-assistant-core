from pathlib import Path
import re

p = Path("app/pricing/page.tsx")
s = p.read_text("utf-8")

# 1) Добавляем state trialText рядом с trialLeft
if "const [trialText, setTrialText]" not in s:
    # универсальный матч под разные варианты useState
    s2, n = re.subn(
        r'(const\s+\[\s*trialLeft\s*,\s*setTrialLeft\s*\]\s*=\s*useState[^\n]*\n)',
        r'\1  const [trialText, setTrialText] = useState<string | null>(null)\n',
        s,
        count=1
    )
    s = s2

# 2) После setTrialLeft(...) добавляем setTrialText(...)
if "setTrialText(" not in s:
    def repl(m):
        line = m.group(0)
        return line + '\n        setTrialText(typeof d?.trialText === "string" ? d.trialText : null)'
    s2, n = re.subn(
        r'^\s*setTrialLeft\([^\n]+\)\s*;?\s*$',
        repl,
        s,
        count=1,
        flags=re.M
    )
    s = s2

# 3) Если label уже заменен на trialText ? "Access" : "Trial left" — ок
# 4) Значение справа: trialText ?? trialLeft
s = s.replace('{loadingSummary ? "…" : trialLeft}', '{loadingSummary ? "…" : (trialText ?? trialLeft)}')

p.write_text(s, "utf-8")
print("✅ pricing/page.tsx fixed: added trialText state + summary set + UI value")
