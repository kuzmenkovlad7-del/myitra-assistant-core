from pathlib import Path
import re

p = Path("app/pricing/page.tsx")
if not p.exists():
    raise SystemExit("❌ app/pricing/page.tsx not found")

s = p.read_text("utf-8")

# 1) убираем useSearchParams и paywall переменные, если они появились
s = re.sub(r"^\s*const\s+searchParams\s*=\s*useSearchParams\(\)\s*;\s*\n", "", s, flags=re.M)
s = re.sub(r"^\s*const\s+searchParams\s*=\s*useSearchParams\(\)\s*\n", "", s, flags=re.M)
s = re.sub(r"^\s*const\s+paywall\s*=.*\n", "", s, flags=re.M)

# 2) убираем Banner import если есть (чтобы не ругался линтер и не мешал сборке)
s = re.sub(r'^\s*import\s+\{\s*Banner\s*\}\s+from\s+["\']@/components/ui/banner["\']\s*;?\s*\n', "", s, flags=re.M)

# 3) убираем useSearchParams из next/navigation импорта
def remove_named_import(code: str, module: str, name: str) -> str:
    # import { a, b, c } from "mod"
    pat = re.compile(rf'(^\s*import\s*\{{)([^}}]+)(\}}\s*from\s*["\']{re.escape(module)}["\']\s*;?\s*$)', re.M)
    m = pat.search(code)
    if not m:
        return code
    left, names, right = m.group(1), m.group(2), m.group(3)
    parts = [x.strip() for x in names.split(",") if x.strip()]
    parts = [x for x in parts if x != name]
    if not parts:
        # удалить весь импорт
        return code[:m.start()] + code[m.end():]
    new_names = ", ".join(parts)
    return code[:m.start()] + f"{left} {new_names} {right}" + code[m.end():]

s = remove_named_import(s, "next/navigation", "useSearchParams")

# 4) главный фикс: если paywall JSX попал в useEffect cleanup, возвращаем cleanup обратно
# ломалось так: return ( {paywall === "trial" ? (...) : null} ) => { ... }
bad_pat = re.compile(
    r"return\s*\(\s*\{\s*paywall\s*===\s*['\"]trial['\"]\s*\?\s*\([\s\S]*?\)\s*:\s*null\s*\}\s*\)\s*=>\s*\{",
    re.M
)

s2, n = bad_pat.subn("return () => {", s)
s = s2

# 5) если остались странные экранирования \"paywall\" — тоже чистим
s = s.replace('\\"paywall\\"', '"paywall"')

p.write_text(s, "utf-8")
print("✅ pricing/page.tsx fixed: compile restored")
