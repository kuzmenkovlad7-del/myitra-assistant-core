import Header from "@/components/header"
import RegisterForm from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-lavender-50 via-white to-blue-100">
      <Header />
      <div className="pt-20 pb-12 px-4">
        <RegisterForm />
      </div>
    </div>
  )
}
