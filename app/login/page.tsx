import Header from "@/components/header"
import LoginForm from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-lavender-100">
      <Header />
      <div className="pt-20 pb-12 px-4">
        <LoginForm />
      </div>
    </div>
  )
}
