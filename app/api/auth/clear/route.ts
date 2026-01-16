import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  const store = cookies()

  // удаляем все supabase cookies (SSR auth часто хранит токен в cookie sb-*-auth-token)
  for (const c of store.getAll()) {
    const name = c.name
    if (
      name.startsWith("sb-") && name.endsWith("-auth-token") ||
      name.includes("supabase") ||
      name.includes("sb-access-token") ||
      name.includes("sb-refresh-token")
    ) {
      try {
        store.delete(name)
      } catch {
        // fallback: иногда delete недоступен, тогда set maxAge=0
        try {
          store.set(name, "", { path: "/", maxAge: 0 })
        } catch {}
      }
    }
  }

  return NextResponse.json({ ok: true })
}
