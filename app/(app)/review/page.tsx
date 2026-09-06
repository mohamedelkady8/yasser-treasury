import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { ReviewView } from "./review-view";
import type { DebtIssue, EntryIssue, EntryView } from "@/lib/database.types";

export const metadata = { title: "المراجعة" };

export default async function ReviewPage() {
  const supabase = await createClient();

  const [issuesRes, debtIssuesRes, lookups] = await Promise.all([
    supabase
      .from("v_entry_issues")
      .select("*")
      .order("issue_count", { ascending: false })
      .order("entry_date", { ascending: false })
      .limit(1000),
    supabase.from("v_debt_issues").select("*"),
    getLookups(),
  ]);

  const issues = (issuesRes.data ?? []) as EntryIssue[];

  // نحتاج القيد كاملًا لفتح نموذج التعديل مباشرة من صفحة المراجعة
  const { data: entriesData } = issues.length
    ? await supabase
        .from("v_entries")
        .select("*")
        .in(
          "id",
          issues.map((i) => i.id)
        )
    : { data: [] };

  return (
    <>
      <PageHeader
        title="المراجعة"
        description="القيود والمديونيات التي تحتاج انتباهًا — هذه ملاحظات لا تمنع العمل"
      />
      <ReviewView
        issues={issues}
        debtIssues={(debtIssuesRes.data ?? []) as DebtIssue[]}
        entries={(entriesData ?? []) as EntryView[]}
        lookups={lookups}
      />
    </>
  );
}

export const revalidate = 0;
