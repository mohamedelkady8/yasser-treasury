import { Suspense } from "react";
import { ShieldCheck, Wallet } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      <div className="w-full max-w-sm rise">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="relative grid size-16 place-items-center animate-float">
            {/* حلقة متوهجة تدور خلف الشعار */}
            <span
              aria-hidden
              className="absolute -inset-2 rounded-[1.6rem] animate-spin-slow opacity-70 blur-md"
              style={{
                background:
                  "conic-gradient(from 0deg, var(--primary), var(--chart-2), var(--chart-5), var(--primary))",
              }}
            />
            <span className="relative grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl shadow-primary/25">
              <Wallet className="size-8" />
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gradient">
              نظام الإيرادات والمصروفات
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              سجّل الدخول للمتابعة
            </p>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-positive" />
          اتصال مُشفَّر — الحسابات تُدار من لوحة التحكم
        </p>
      </div>
    </main>
  );
}
