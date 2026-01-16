from pathlib import Path

p = Path("app/profile/page.tsx")
s = p.read_text("utf-8")

s = s.replace("s?.unlimited", "(s as any)?.unlimited")
s = s.replace("s?.trialText", "(s as any)?.trialText")
s = s.replace("s?.access", "(s as any)?.access")

p.write_text(s, "utf-8")
print("✅ profile/page.tsx fixed: unlimited/trialText typed safely")
