import { Suspense } from "react";
import { Wallet } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-br from-primary/10 via-background to-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Wallet className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">نظام الإيرادات والمصروفات</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              سجّل الدخول للمتابعة
            </p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
