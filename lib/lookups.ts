import { createClient } from "@/lib/supabase/server";

export type Lookups = Awaited<ReturnType<typeof getLookups>>;

/** كل القوائم المرجعية التي تحتاجها النماذج والفلاتر في استدعاء واحد */
export async function getLookups() {
  const supabase = await createClient();

  const [accounts, ledgers, costCenters, revenueTypes, banks, debts, creditors] =
    await Promise.all([
      supabase.from("accounts").select("id,name").order("name"),
      supabase.from("ledgers").select("id,name").order("name"),
      supabase
        .from("cost_centers")
        .select("id,name,is_custody,custody_opening,custody_holder")
        .order("name"),
      supabase.from("revenue_types").select("id,name,is_opening").order("name"),
      supabase.from("banks").select("id,name,is_usd").order("sort_order"),
      supabase
        .from("v_debt_balances")
        .select("id,description,creditor_name,remaining,account_id,ledger_id,cost_center_id,state")
        .in("state", ["open", "overdue"])
        .order("debt_date", { ascending: false }),
      supabase.from("creditors").select("id,name").order("name"),
    ]);

  return {
    accounts: accounts.data ?? [],
    ledgers: ledgers.data ?? [],
    costCenters: costCenters.data ?? [],
    revenueTypes: revenueTypes.data ?? [],
    banks: banks.data ?? [],
    openDebts: debts.data ?? [],
    creditors: creditors.data ?? [],
  };
}
