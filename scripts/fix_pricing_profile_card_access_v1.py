from pathlib import Path
import re

p = Path("app/pricing/page.tsx")
s = p.read_text("utf-8")

# Ищем "Trial left" и заменяем на "Access" когда есть trialText
s = s.replace(">Trial left<", ">{trialText ? \"Access\" : \"Trial left\"}<")

# Если где-то выводится {trialLeft} — делаем {trialText ?? trialLeft}
s = re.sub(r"\{(\s*trialLeft\s*)\}", r"{trialText ?? \1}", s, count=1)

p.write_text(s, "utf-8")
print("✅ pricing fixed: card shows Access when promo/paid")
