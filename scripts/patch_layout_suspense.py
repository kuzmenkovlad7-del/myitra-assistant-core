from pathlib import Path
import re

p = Path("app/layout.tsx")
if not p.exists():
    raise SystemExit("❌ app/layout.tsx not found")

s = p.read_text("utf-8")

# 1) добавить Suspense import
if "Suspense" not in s:
    # если есть импорт из react — дополним
    m = re.search(r'^\s*import\s+\*\s+as\s+React\s+from\s+["\']react["\']\s*;?\s*$', s, flags=re.M)
    if m:
        # если вдруг импорт * as React, то добавим отдельным импортом
        s = 'import { Suspense } from "react"\n' + s
    else:
        m2 = re.search(r'^\s*import\s+React\s*(?:,\s*\{[^}]*\})?\s*from\s+["\']react["\']\s*;?\s*$', s, flags=re.M)
        if m2:
            # import React from "react" -> import React, { Suspense } from "react"
            line = m2.group(0)
            if "{" in line:
                # уже есть { ... }
                line2 = re.sub(r"\{([^}]*)\}", lambda mm: "{ " + mm.group(1).strip() + ", Suspense }", line)
            else:
                line2 = line.replace('from "react"', '{ Suspense } from "react"')
                line2 = line.replace('import React', 'import React, { Suspense }')
            s = s.replace(line, line2, 1)
        else:
            # просто добавим импорт в начало
            s = 'import { Suspense } from "react"\n' + s

# 2) завернуть <body>...</body> в <Suspense>
if "<Suspense" not in s:
    # вставим после открывающего тега body
    body_open = re.search(r"<body([^>]*)>", s)
    body_close = s.find("</body>")

    if not body_open or body_close == -1:
        raise SystemExit("❌ Could not find <body>...</body> in layout")

    insert_after = body_open.end()

    # найдём отступ для body контента
    # берем строку после <body...>
    after = s[insert_after:]
    nl = after.find("\n")
    indent = "  "
    if nl != -1:
        next_line = after[nl+1:]
        m_indent = re.match(r"(\s*)", next_line)
        if m_indent:
            indent = m_indent.group(1)

    s = s[:insert_after] + f"\n{indent}<Suspense fallback={{{{null}}}}>" + s[insert_after:]
    s = s[:body_close] + f"\n{indent}</Suspense>\n" + s[body_close:]

# небольшой косметический фикс на fallback ({{null}} -> null)
s = s.replace("fallback={{null}}", "fallback={null}")

p.write_text(s, "utf-8")
print("✅ layout patched: body wrapped in Suspense")
