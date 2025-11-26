// app/register/page.tsx
import { redirect } from "next/navigation"

export default function RegisterPage() {
  // Поки що окремая реєстрація не потрібна — переводимо на сторінку входу
  redirect("/login")
}
