import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { EntriesView } from "./entries-view";
import type {
  EntryKind,
  EntryView,
  MovementType,
  ReconStatus,
} from "@/lib/database.types";

const PAGE_SIZE = 50;

export const metadata = { title: "سجل القيود" };

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const kindParam = one(sp.kind);
  const filters = {
    kind: (kindParam === "revenue" || kindParam === "expense"
      ? kindParam
      : "") as EntryKind | "",
    q: one(sp.q).trim(),
    from: one(sp.from),
    to: one(sp.to),
    bank: one(sp.bank),
    account: one(sp.account),
    ledger: one(sp.ledger),
    cost_center: one(sp.cost_center),
    movement: one(sp.movement) as MovementType | "",
    recon: one(sp.recon) as ReconStatus | "",
  };
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const supabase = await createClient();

  // نفس الفلاتر تُطبَّق على الصفحة المعروضة وعلى إجمالي المطابق
  const build = () => {
    let q = supabase.from("v_entries").select("*", { count: "exact" });
    if (filters.kind) q = q.eq("kind", filters.kind);
    if (filters.from) q = q.gte("entry_date", filters.from);
    if (filters.to) q = q.lte("entry_date", filters.to);
    if (filters.bank) q = q.eq("bank_id", filters.bank);
    if (filters.account) q = q.eq("account_id", filters.account);
    if (filters.ledger) q = q.eq("ledger_id", filters.ledger);
    if (filters.cost_center) q = q.eq("cost_center_id", filters.cost_center);
    if (filters.movement) q = q.eq("movement_type", filters.movement);
    if (filters.recon) q = q.eq("recon_status", filters.recon);
    if (filters.q) {
      const safe = filters.q.replace(/[,()*]/g, " ").trim();
      if (safe)
        q = q.or(
          `description.ilike.%${safe}%,entry_code.ilike.%${safe}%,note.ilike.%${safe}%`
        );
    }
    return q;
  };

  const [{ data, count }, totals, lookups] = await Promise.all([
    build()
      .order("entry_date", { ascending: false })
      .order("entry_code", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    build().select("kind,amount").limit(5000),
    getLookups(),
  ]);

  const rows = (data ?? []) as EntryView[];
  const matched = (totals.data ?? []) as { kind: string; amount: number }[];
  const sums = {
    revenue: matched
      .filter((r) => r.kind === "revenue")
      .reduce((s, r) => s + Number(r.amount), 0),
    expense: matched
      .filter((r) => r.kind === "expense")
      .reduce((s, r) => s + Number(r.amount), 0),
  };

  return (
    <>
      <PageHeader
        title="سجل القيود"
        description={`${(count ?? 0).toLocaleString("en-US")} قيد مطابق للفلاتر الحالية`}
      />
      <EntriesView
        rows={rows}
        lookups={lookups}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        sums={sums}
      />
    </>
  );
}
