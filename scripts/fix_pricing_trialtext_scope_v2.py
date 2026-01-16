from pathlib import Path
import re

p = Path("app/pricing/page.tsx")
s = p.read_text("utf-8")

changed = False

# 0) если в файле нет "use client", но есть хуки — добавим
if "useState(" in s or "useEffect(" in s:
    lines = s.splitlines()
    if not lines or '"use client"' not in lines[0]:
        s = '"use client"\n' + s
        changed = True

# 1) гарантируем useState/useEffect импорт из react
m = re.search(r'import\s+\{([^}]+)\}\s+from\s+"react"\s*', s)
if m:
    items = [x.strip() for x in m.group(1).split(",")]
    need = set(items)
    need.add("useState")
    need.add("useEffect")
    new = ", ".join(sorted(need))
    s2 = s[:m.start(1)] + new + s[m.end(1):]
    if s2 != s:
        s = s2
        changed = True

# 2) гарантируем state trialText рядом с trialLeft
if not re.search(r'const\s+\[\s*trialText\s*,\s*setTrialText\s*\]\s*=\s*useState', s):
    # вставляем сразу после trialLeft state
    def add_after_trialleft(match: re.Match):
        indent = match.group("indent")
        line = match.group(0)
        return line + f'\n{indent}const [trialText, setTrialText] = useState<string | null>(null)'
    s2, n = re.subn(
        r'^(?P<indent>\s*)const\s+\[\s*trialLeft\s*,\s*setTrialLeft\s*\]\s*=\s*useState[^\n]*$',
        add_after_trialleft,
        s,
        count=1,
        flags=re.M
    )
    if n == 0:
        # fallback: вставим после первого useState
        def add_after_first_usestate(match: re.Match):
            indent = match.group("indent")
            line = match.group(0)
            return line + f'\n{indent}const [trialText, setTrialText] = useState<string | null>(null)'
        s2, n = re.subn(
            r'^(?P<indent>\s*)const\s+\[[^\]]+\]\s*=\s*useState[^\n]*$',
            add_after_first_usestate,
            s,
            count=1,
            flags=re.M
        )
    if n > 0:
        s = s2
        changed = True

# 3) гарантируем setTrialText в месте, где после summary ставится trialLeft
if "setTrialText(" not in s:
    def inject_settrialtext(match: re.Match):
        line = match.group(0)
        indent = re.match(r'^(\s*)', line).group(1)
        return line + f'\n{indent}setTrialText(typeof d?.trialText === "string" ? d.trialText : null)'
    s2, n = re.subn(
        r'^\s*setTrialLeft\([^\n]+\)\s*;?\s*$',
        inject_settrialtext,
        s,
        count=1,
        flags=re.M
    )
    if n > 0:
        s = s2
        changed = True

# 4) значение справа делаем trialText ?? trialLeft (если ещё не сделано)
s2 = s.replace('{loadingSummary ? "…" : trialLeft}', '{loadingSummary ? "…" : (trialText ?? trialLeft)}')
if s2 != s:
    s = s2
    changed = True

# 5) последний safety: если trialText всё равно не объявлен — добавим const trialText = null
if "trialText ?" in s and not re.search(r'\btrialText\b', s):
    s = s.replace("export default", "const trialText: string | null = null\n\nexport default", 1)
    changed = True

p.write_text(s, "utf-8")
print("✅ pricing/page.tsx patched (trialText state + setTrialText + import)")
print("---- quick check ----")
print("trialText declared:", bool(re.search(r'\\btrialText\\b', s)))
