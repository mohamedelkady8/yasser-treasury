import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Banknote,
  ChartNoAxesCombined,
  HandCoins,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  ShieldAlert,
  Users,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string | null; items: NavItem[] };

/**
 * القائمة مجمَّعة بحسب ما يفعله المحاسب لا بحسب ترتيب الجداول:
 * الشاشتان اليوميتان أولًا، ثم ما يمسّ الأرصدة والالتزامات، ثم المتابعة والضبط.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "لوحة المعلومات", icon: LayoutDashboard },
      { href: "/entries", label: "سجل القيود", icon: ReceiptText },
    ],
  },
  {
    label: "الأرصدة والالتزامات",
    items: [
      { href: "/banks", label: "البنوك والخزائن", icon: Banknote },
      { href: "/custody", label: "العهد", icon: HandCoins },
      { href: "/debts", label: "المديونيات", icon: BadgeDollarSign },
      { href: "/creditors", label: "الموردون والدائنون", icon: Users },
    ],
  },
  {
    label: "المتابعة والضبط",
    items: [
      { href: "/reports", label: "التقارير", icon: ChartNoAxesCombined },
      { href: "/review", label: "المراجعة", icon: ShieldAlert },
      { href: "/lists", label: "إدارة القوائم", icon: ListChecks },
    ],
  },
];
