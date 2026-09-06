import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CreditorsView } from "./creditors-view";
import type { CreditorBalance } from "@/lib/database.types";

export const metadata = { title: "الموردون والدائنون" };

export default async function CreditorsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_creditor_balances")
    .select("*")
    .order("remaining", { ascending: false });

  return (
    <>
      <PageHeader
        title="الموردون والدائنون"
        description="إجمالي ما لهم عليك، مجموعًا من كل مديونياتهم القائمة"
      />
      <CreditorsView creditors={(data ?? []) as CreditorBalance[]} />
    </>
  );
}

export const revalidate = 0;
