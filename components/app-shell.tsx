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
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ company }: { company: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Wallet className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          {company}
        </p>
        <p className="text-xs text-sidebar-foreground/60">الإيرادات والمصروفات</p>
      </div>
    </div>
  );
}

function Footer({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <p
        dir="ltr"
        className="mb-2 truncate px-3 text-start text-xs text-sidebar-foreground/60"
      >
        {email}
      </p>
      <form action={onSignOut}>
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand company={company} />
        <NavLinks />
        <Footer email={email} onSignOut={signOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">القائمة</SheetTitle>
              <div className="flex h-full flex-col">
                <Brand company={company} />
                <NavLinks onNavigate={() => setOpen(false)} />
                <Footer email={email} onSignOut={signOut} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">{company}</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
