import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ListsView } from "./lists-view";
import type { Account, CostCenter, Ledger, RevenueType } from "@/lib/database.types";

export const metadata = { title: "إدارة القوائم" };

export default async function ListsPage() {
  const supabase = await createClient();

  const [accounts, ledgers, costCenters, revenueTypes, usageRes] = await Promise.all([
    supabase.from("accounts").select("*").order("name"),
    supabase.from("ledgers").select("*").order("name"),
    supabase.from("cost_centers").select("*").order("name"),
    supabase.from("revenue_types").select("*").order("name"),
    supabase
      .from("entries")
      .select("account_id,ledger_id,cost_center_id,revenue_type_id")
      .limit(20000),
  ]);

  // عدّاد الاستخدام يمنع حذف بند مرتبط بقيود عن طريق الخطأ
  const usage = { account: {}, ledger: {}, cost_center: {}, revenue_type: {} } as Record<
    string,
    Record<string, number>
  >;
  for (const row of usageRes.data ?? []) {
    const pairs: [string, string | null][] = [
      ["account", row.account_id],
      ["ledger", row.ledger_id],
      ["cost_center", row.cost_center_id],
      ["revenue_type", row.revenue_type_id],
    ];
    for (const [key, id] of pairs)
      if (id) usage[key][id] = (usage[key][id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader
        title="إدارة القوائم"
        description="الحسابات والأستاذ العام ومراكز التكلفة وأنواع الإيراد — كل بند مرتبط بقيوده بمفتاح حقيقي"
      />
      <ListsView
        accounts={(accounts.data ?? []) as Account[]}
        ledgers={(ledgers.data ?? []) as Ledger[]}
        costCenters={(costCenters.data ?? []) as CostCenter[]}
        revenueTypes={(revenueTypes.data ?? []) as RevenueType[]}
        usage={usage}
      />
    </>
  );
}

export const revalidate = 0;
