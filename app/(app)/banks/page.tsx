import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { BanksView } from "./banks-view";
import type { BankBalance, Settings } from "@/lib/database.types";

export const metadata = { title: "البنوك والخزائن" };

export default async function BanksPage() {
  const supabase = await createClient();

  const [banksRes, settingsRes] = await Promise.all([
    supabase.from("v_bank_balances").select("*").order("sort_order"),
    supabase.from("settings").select("*").single(),
  ]);

  return (
    <>
      <PageHeader
        title="البنوك والخزائن"
        description="الرصيد = الافتتاحي + الإيراد − المصروف (باستثناء المصروف من العهدة) + مرتجع العهد"
      />
      <BanksView
        banks={(banksRes.data ?? []) as BankBalance[]}
        settings={settingsRes.data as Settings}
      />
    </>
  );
}

export const revalidate = 0;
