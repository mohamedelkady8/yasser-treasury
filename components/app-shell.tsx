"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Wallet } from "lucide-react";
import { NAV_GROUPS } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="scroll-slim flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? i} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-muted-foreground">
              {group.label}
            </p>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  active
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/30"
                    : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand({ company }: { company: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/30">
        <Wallet className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          {company}
        </p>
        <p className="text-xs text-muted-foreground">الإيرادات والمصروفات</p>
      </div>
    </div>
  );
}

function Footer({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const initial = email.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
        {initial}
      </span>
      <p
        dir="ltr"
        className="min-w-0 flex-1 truncate text-start text-xs text-muted-foreground"
      >
        {email}
      </p>
      <form action={onSignOut}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="تسجيل الخروج"
              className="size-8 shrink-0 text-muted-foreground hover:bg-negative/10 hover:text-negative"
            >
              <LogOut className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>تسجيل الخروج</TooltipContent>
        </Tooltip>
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
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <Brand company={company} />
        <NavLinks />
        <Footer email={email} onSignOut={signOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-sidebar-border bg-sidebar p-0"
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
