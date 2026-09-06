import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { HandCoins, Receipt, Undo2 } from "lucide-react";
import { CustodyView } from "./custody-view";
import type { CustodyBalance, EntryView } from "@/lib/database.types";

export const metadata = { title: "العهد" };

export default async function CustodyPage() {
  const supabase = await createClient();

  const [custodyRes, movesRes, lookups] = await Promise.all([
    supabase
      .from("v_custody_balances")
      .select("*")
      .order("balance", { ascending: false }),
    supabase
      .from("v_entries")
      .select("*")
      .in("movement_type", ["custody_out", "custody_expense", "custody_return"])
      .order("entry_date", { ascending: false }),
    getLookups(),
  ]);

  const custody = (custodyRes.data ?? []) as CustodyBalance[];
  const moves = (movesRes.data ?? []) as EntryView[];

  const totals = custody.reduce(
    (acc, c) => ({
      balance: acc.balance + Number(c.balance),
      paid_out: acc.paid_out + Number(c.paid_out),
      spent: acc.spent + Number(c.spent),
      returned: acc.returned + Number(c.returned),
    }),
    { balance: 0, paid_out: 0, spent: 0, returned: 0 }
  );

  const orphans = moves.filter((m) => !m.cost_center_id);

  return (
    <>
      <PageHeader
        title="العهد"
        description="العهدة مال الشركة في يد موظف — تظهر ضمن النقدية حتى تُصفَّى"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="العهد القائمة"
          value={totals.balance}
          hint={`${custody.filter((c) => c.state !== "settled").length} عهدة لم تُصفَّ`}
          icon={HandCoins}
          tone="warning"
        />
        <StatCard
          label="إجمالي ما صُرف"
          value={totals.paid_out}
          hint="خرج من البنوك إلى الموظفين"
          icon={HandCoins}
          tone="primary"
        />
        <StatCard
          label="أُنفق من العهد"
          value={totals.spent}
          hint="يُحسب مصروفًا تشغيليًا فعليًا"
          icon={Receipt}
          tone="negative"
        />
        <StatCard
          label="رُدَّ إلى البنوك"
          value={totals.returned}
          hint="مرتجع العهد"
          icon={Undo2}
          tone="positive"
        />
      </div>

      <CustodyView
        custody={custody}
        moves={moves}
        lookups={lookups}
        orphanCount={orphans.length}
      />
    </>
  );
}

export const revalidate = 0;
