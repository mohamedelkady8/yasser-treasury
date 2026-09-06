import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { BadgeDollarSign, CircleCheck, Clock, Wallet } from "lucide-react";
import { DebtsView } from "./debts-view";
import type { CashPosition, DebtView, EntryView } from "@/lib/database.types";

export const metadata = { title: "المديونيات" };

export default async function DebtsPage() {
  const supabase = await createClient();

  const [debtsRes, paymentsRes, cashRes, lookups] = await Promise.all([
    supabase
      .from("v_debt_balances")
      .select("*")
      .order("debt_date", { ascending: false }),
    supabase
      .from("v_entries")
      .select("*")
      .not("debt_id", "is", null)
      .order("entry_date", { ascending: false }),
    supabase.from("v_cash_position").select("*").single(),
    getLookups(),
  ]);

  const debts = (debtsRes.data ?? []) as DebtView[];
  const payments = (paymentsRes.data ?? []) as EntryView[];
  const cash = (cashRes.data ?? {}) as CashPosition;

  const open = debts.filter((d) => d.state === "open" || d.state === "overdue");
  const settled = debts.filter((d) => d.state === "settled");
  const totalRemaining = open.reduce((s, d) => s + Number(d.remaining), 0);
  const totalPaid = debts
    .filter((d) => d.state !== "cancelled")
    .reduce((s, d) => s + Number(d.paid_amount), 0);
  const overdue = debts.filter((d) => d.state === "overdue");

  return (
    <>
      <PageHeader
        title="المديونيات"
        description="الالتزامات المتفق عليها مع الموردين، وكل دفعة قيد مصروف مربوط بها"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي المتبقي للموردين"
          value={totalRemaining}
          hint={`${open.length} مديونية قائمة`}
          icon={BadgeDollarSign}
          tone="negative"
        />
        <StatCard
          label="المدفوع حتى الآن"
          value={totalPaid}
          hint="خرج فعليًا من الخزنة"
          icon={CircleCheck}
          tone="positive"
        />
        <StatCard
          label="متأخرة عن الاستحقاق"
          value={overdue.reduce((s, d) => s + Number(d.remaining), 0)}
          hint={`${overdue.length} مديونية فات موعدها`}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="المتاح بعد سداد المديونيات"
          value={cash.available_after_debts}
          hint={`إجمالي النقدية ${Number(cash.total_cash ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          icon={Wallet}
          tone="primary"
          sign
        />
      </div>

      <DebtsView
        debts={debts}
        payments={payments}
        lookups={lookups}
        settledCount={settled.length}
      />
    </>
  );
}

export const revalidate = 0;
