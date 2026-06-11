import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-gold-soft)] p-8 shadow-lg">
        <h1 className="text-3xl mb-6 text-center">가족 갤러리</h1>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
