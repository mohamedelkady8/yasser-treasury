import {
  BadgeDollarSign,
  Banknote,
  HandCoins,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  Settings2,
  ShieldAlert,
  Users,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "لوحة المعلومات", icon: LayoutDashboard },
  { href: "/entries", label: "سجل القيود", icon: ReceiptText },
  { href: "/custody", label: "العهد", icon: HandCoins },
  { href: "/debts", label: "المديونيات", icon: BadgeDollarSign },
  { href: "/creditors", label: "الموردون والدائنون", icon: Users },
  { href: "/banks", label: "البنوك والخزائن", icon: Banknote },
  { href: "/lists", label: "إدارة القوائم", icon: Settings2 },
  { href: "/review", label: "المراجعة", icon: ShieldAlert },
  { href: "/reports", label: "التقارير", icon: ListChecks },
] as const;
