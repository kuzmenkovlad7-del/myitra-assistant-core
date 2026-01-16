from pathlib import Path
import re

p = Path("components/header.tsx")
s = p.read_text("utf-8")

# add state for trialText
if "trialText" not in s:
    s = s.replace(
        "const [trialLeft, setTrialLeft] = useState<number | null>(null)",
        "const [trialLeft, setTrialLeft] = useState<number | null>(null)\n  const [trialText, setTrialText] = useState<string | null>(null)",
        1,
    )

# setTrialText in fetch
if "setTrialText(" not in s and 'fetch("/api/account/summary")' in s:
    s = s.replace(
        "setTrialLeft(typeof d?.trialLeft === \"number\" ? d.trialLeft : null)",
        "setTrialLeft(typeof d?.trialLeft === \"number\" ? d.trialLeft : null)\n        setTrialText(typeof d?.trialText === \"string\" ? d.trialText : null)",
        1,
    )

# render replace: show Access text if trialText exists
# ищем место где выводится Trial left
s = re.sub(
    r'\{hasAccess\s*\?\s*"Access:\s*Active"\s*:\s*`Trial left:\s*\$\{trialLeft\}`\}',
    '{trialText ? `Access: ${trialText}` : hasAccess ? "Access: Active" : `Trial left: ${trialLeft}`}',
    s,
    count=1,
    flags=re.M,
)

p.write_text(s, "utf-8")
print("✅ header patched: shows Access: Doctor access / Unlimited")
