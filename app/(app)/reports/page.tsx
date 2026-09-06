import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { Money } from "@/components/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButtons } from "./export-buttons";
import { egp, fmtMonth, num, pct } from "@/lib/format";
import type {
  BankBalance,
  Breakdown,
  CashPosition,
  CustodyBalance,
  DebtView,
  MonthlySummary,
  OperationalTotals,
} from "@/lib/database.types";

export const metadata = { title: "التقارير" };

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
  const s = (Array.isArray(v) ? v[0] : v) ?? "";
  return s || null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const range = { p_from: one(sp.from), p_to: one(sp.to) };

  const supabase = await createClient();

  const [
    totalsRes,
    monthlyRes,
    byCcRes,
    byLedgerRes,
    byAccountRes,
    revByTypeRes,
    banksRes,
    custodyRes,
    debtsRes,
    cashRes,
  ] = await Promise.all([
    supabase.rpc("f_operational_totals", range),
    supabase.rpc("f_monthly_summary"),
    supabase.rpc("f_expense_by_cost_center", { ...range, p_limit: 100 }),
    supabase.rpc("f_expense_by_ledger", { ...range, p_limit: 100 }),
    supabase.rpc("f_expense_by_account", { ...range, p_limit: 100 }),
    supabase.rpc("f_revenue_by_type", { ...range, p_limit: 100 }),
    supabase.from("v_bank_balances").select("*").order("sort_order"),
    supabase.from("v_custody_balances").select("*").order("name"),
    supabase.from("v_debt_balances").select("*").order("remaining", { ascending: false }),
    supabase.from("v_cash_position").select("*").single(),
  ]);

  const totals = ((totalsRes.data as OperationalTotals[] | null)?.[0] ??
    {}) as OperationalTotals;
  const monthly = (monthlyRes.data ?? []) as MonthlySummary[];
  const byCc = (byCcRes.data ?? []) as Breakdown[];
  const byLedger = (byLedgerRes.data ?? []) as Breakdown[];
  const byAccount = (byAccountRes.data ?? []) as Breakdown[];
  const revByType = (revByTypeRes.data ?? []) as Breakdown[];
  const banks = (banksRes.data ?? []) as BankBalance[];
  const custody = (custodyRes.data ?? []) as CustodyBalance[];
  const debts = (debtsRes.data ?? []) as DebtView[];
  const cash = (cashRes.data ?? {}) as CashPosition;

  const openDebts = debts.filter((d) => d.state === "open" || d.state === "overdue");
  const period =
    range.p_from || range.p_to
      ? `من ${range.p_from ?? "البداية"} إلى ${range.p_to ?? "النهاية"}`
      : "كل الفترات";

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="التقارير" description="تقرير شامل بفلتر فترة قابل للتصدير">
          <PeriodFilter />
          <ExportButtons from={range.p_from} to={range.p_to} />
        </PageHeader>
      </div>

      <div className="space-y-6 print:space-y-4">
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">تقرير الإيرادات والمصروفات</h1>
          <p className="text-sm text-muted-foreground">{period}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ملخص الفترة — {period}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <SummaryRow
                  label="الإيراد التشغيلي"
                  value={totals.revenue}
                  note={`${num(totals.revenue_count)} قيد`}
                />
                <SummaryRow
                  label="منها أرصدة افتتاحية"
                  value={totals.opening_balances}
                  note="نقطة بداية لا إيراد حقيقي"
                  muted
                />
                <SummaryRow
                  label="الإيراد بدون الأرصدة الافتتاحية"
                  value={totals.revenue_excl_opening}
                  muted
                />
                <SummaryRow
                  label="المصروف التشغيلي"
                  value={totals.expense}
                  note={`${num(totals.expense_count)} قيد — يشمل المصروف من العهد`}
                />
                <SummaryRow label="صافي التشغيل" value={totals.net} strong />
                <SummaryRow
                  label="التحويلات الداخلية"
                  value={totals.internal_transfers}
                  note="لا تُحسب إيرادًا أو مصروفًا"
                  muted
                />
                <SummaryRow
                  label="صرف العهد"
                  value={totals.custody_out_total}
                  note="خرج من البنوك إلى الموظفين"
                  muted
                />
                <SummaryRow
                  label="المصروف من العهد"
                  value={totals.custody_expense_total}
                  muted
                />
                <SummaryRow
                  label="مرتجع العهد"
                  value={totals.custody_return_total}
                  muted
                />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الموقف النقدي الحالي</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <SummaryRow label="أرصدة البنوك والخزائن" value={cash.bank_total} />
                <SummaryRow
                  label="العهد القائمة عند الموظفين"
                  value={cash.custody_total}
                />
                <SummaryRow label="إجمالي النقدية" value={cash.total_cash} strong />
                <SummaryRow
                  label="المديونيات المتبقية للموردين"
                  value={cash.debts_outstanding}
                  note={`${openDebts.length} مديونية قائمة`}
                />
                <SummaryRow
                  label="المتاح بعد سداد كل المديونيات"
                  value={cash.available_after_debts}
                  strong
                />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {monthly.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الملخص الشهري</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>الشهر</TableHead>
                    <TableHead className="text-end">الإيراد</TableHead>
                    <TableHead className="text-end">المصروف</TableHead>
                    <TableHead className="text-end">الصافي</TableHead>
                    <TableHead className="w-24 text-center">القيود</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthly.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">{fmtMonth(m.month)}</TableCell>
                      <TableCell className="text-end">
                        <Money value={m.revenue} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={m.expense} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={m.net} currency={false} sign />
                      </TableCell>
                      <TableCell className="num text-center text-xs text-muted-foreground">
                        {m.entry_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <BreakdownTable
            title="الإيراد حسب النوع"
            rows={revByType}
            total={Number(totals.revenue ?? 0)}
          />
          <BreakdownTable
            title="المصروف حسب مركز التكلفة"
            rows={byCc}
            total={Number(totals.expense ?? 0)}
          />
          <BreakdownTable
            title="المصروف حسب الأستاذ العام"
            rows={byLedger}
            total={Number(totals.expense ?? 0)}
          />
          <BreakdownTable
            title="المصروف حسب اسم الحساب"
            rows={byAccount}
            total={Number(totals.expense ?? 0)}
          />
        </div>

        {custody.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أرصدة العهد</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>العهدة</TableHead>
                    <TableHead className="text-end">صُرف</TableHead>
                    <TableHead className="text-end">أُنفق</TableHead>
                    <TableHead className="text-end">رُدَّ</TableHead>
                    <TableHead className="text-end">الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custody.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-end">
                        <Money value={c.paid_out} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={c.spent} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={c.returned} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={c.balance} currency={false} sign />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">أرصدة البنوك والخزائن</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>البنك / الخزينة</TableHead>
                  <TableHead className="text-end">الافتتاحي</TableHead>
                  <TableHead className="text-end">صافي الحركة</TableHead>
                  <TableHead className="text-end">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-end">
                      <Money value={b.opening_balance} currency={false} />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={b.net_movement} currency={false} sign />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={b.balance} currency={false} sign />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {openDebts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">المديونيات القائمة</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>المورد</TableHead>
                    <TableHead>المديونية</TableHead>
                    <TableHead className="text-end">الإجمالي</TableHead>
                    <TableHead className="text-end">المدفوع</TableHead>
                    <TableHead className="text-end">المتبقي</TableHead>
                    <TableHead className="w-20 text-center">السداد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openDebts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.creditor_name}</TableCell>
                      <TableCell className="text-sm">{d.description}</TableCell>
                      <TableCell className="text-end">
                        <Money value={d.total_amount} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={d.paid_amount} currency={false} />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={d.remaining} currency={false} />
                      </TableCell>
                      <TableCell className="num text-center text-xs">
                        {pct(d.paid_pct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  note,
  strong,
  muted,
}: {
  label: string;
  value: number | string | null | undefined;
  note?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <TableRow className={strong ? "bg-muted/50 font-semibold" : ""}>
      <TableCell className={muted ? "text-muted-foreground" : ""}>
        {label}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </TableCell>
      <TableCell className="w-44 text-end">
        <Money value={value} currency={false} sign={strong} />
      </TableCell>
    </TableRow>
  );
}

function BreakdownTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Breakdown[];
  total: number;
}) {
  const sum = rows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            لا توجد بيانات في هذه الفترة
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>البند</TableHead>
                <TableHead className="w-16 text-center">القيود</TableHead>
                <TableHead className="w-36 text-end">الإجمالي</TableHead>
                <TableHead className="w-16 text-end">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="truncate">{r.name}</TableCell>
                  <TableCell className="num text-center text-xs text-muted-foreground">
                    {r.cnt}
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={r.total} currency={false} />
                  </TableCell>
                  <TableCell className="num text-end text-xs text-muted-foreground">
                    {total > 0 ? pct((Number(r.total) / total) * 100) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>الإجمالي</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-end num">{egp(sum)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export const revalidate = 0;
