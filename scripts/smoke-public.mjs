const base = process.env.BASE || "http://127.0.0.1:3000"

const paths = [
  "/",
  "/about",
  "/pricing",
  "/contacts",
  "/login",
  "/register",
  "/subscription",
  "/profile",
  "/payment/return?orderReference=TEST123",
]

let bad = 0

for (const p of paths) {
  try {
    const r = await fetch(base + p, { redirect: "manual" })
    const ok = r.status < 400
    console.log(`${ok ? "OK" : "BAD"} ${r.status} -> ${p}`)
    if (!ok) bad++
  } catch (e) {
    console.log(`ERR -> ${p} :: ${(e && e.message) ? e.message : e}`)
    bad++
  }
}

process.exitCode = bad ? 1 : 0
