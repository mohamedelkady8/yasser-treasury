"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Wallet } from "lucide-react";
import { NAV_ITEMS } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scroll-slim p-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-gradient-to-l from-sidebar-primary/25 to-sidebar-primary/5 text-sidebar-primary-foreground shadow-sm ring-1 ring-sidebar-primary/30"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            )}
          >
            {/* المؤشر الجانبي للعنصر النشط */}
            <span
              className={cn(
                "absolute inset-y-1.5 -start-3 w-1 rounded-full bg-sidebar-primary transition-all duration-300",
                active ? "translate-x-3 opacity-100" : "opacity-0"
              )}
            />
            <Icon
              className={cn(
                "size-[18px] shrink-0 transition-transform duration-200",
                active ? "text-sidebar-primary" : "group-hover:scale-110"
              )}
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ company }: { company: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border/60 px-4 py-4">
      <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/60 text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25">
        {/* هالة نابضة حول الشعار */}
        <span className="absolute inset-0 rounded-xl bg-sidebar-primary/40 blur-md animate-pulse" />
        <Wallet className="relative size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          {company}
        </p>
        <p className="text-xs text-sidebar-foreground/55">الإيرادات والمصروفات</p>
      </div>
    </div>
  );
}

function Footer({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const initial = email.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="border-t border-sidebar-border/60 p-3">
      <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-sidebar-accent/40 px-2.5 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
          {initial}
        </span>
        <p
          dir="ltr"
          className="min-w-0 flex-1 truncate text-start text-xs text-sidebar-foreground/60"
        >
          {email}
        </p>
      </div>
      <form action={onSignOut}>
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start gap-3 rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-negative/15 hover:text-negative"
        >
          <LogOut className="size-[18px]" />
          خروج
        </Button>
      </form>
    </div>
  );
}

export function AppShell({
  email,
  company,
  children,
  signOut,
}: {
  email: string;
  company: string;
  children: React.ReactNode;
  signOut: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-sidebar-border/60 bg-gradient-to-b from-sidebar to-sidebar/85 backdrop-blur-xl lg:flex">
        <Brand company={company} />
        <NavLinks />
        <Footer email={email} onSignOut={signOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/60 bg-background/60 px-4 py-3 backdrop-blur-xl dark:border-white/10 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-sidebar-border/60 bg-gradient-to-b from-sidebar to-sidebar/90 p-0 backdrop-blur-xl"
            >
              <SheetTitle className="sr-only">القائمة</SheetTitle>
              <div className="flex h-full flex-col">
                <Brand company={company} />
                <NavLinks onNavigate={() => setOpen(false)} />
                <Footer email={email} onSignOut={signOut} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="truncate font-semibold">{company}</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
