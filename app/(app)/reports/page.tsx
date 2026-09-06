import { Building2, CalendarRange, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { Money } from "@/components/money";
import { CompositionChart, MonthlyTrendChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButtons } from "./export-buttons";
import { ReportNav, type Section } from "./report-nav";
import { Delta, KpiTile, ReportSection, ShareBar } from "./report-parts";
import { egp, fmtDateLong, fmtMonth, num, pct, toUsd, usd } from "@/lib/format";
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

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * الفترة السابقة المكافئة: نفس عدد الأيام وتنتهي قبل بداية الفترة الحالية.
 * تُحسب فقط عندما تكون الفترة محددة الطرفين — «كل الفترات» لا سابق لها.
 */
function previousRange(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const span = end - start + DAY;
  return { p_from: iso(start - span), p_to: iso(start - DAY) };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const from = one(sp.from);
  const to = one(sp.to);
  const range = { p_from: from, p_to: to };
  const prev = previousRange(from, to);

  const supabase = await createClient();

  const [
    totalsRes,
    prevTotalsRes,
    monthlyRes,
    byCcRes,
    byLedgerRes,
    byAccountRes,
    revByTypeRes,
    banksRes,
    custodyRes,
    debtsRes,
    cashRes,
    settingsRes,
  ] = await Promise.all([
    supabase.rpc("f_operational_totals", range),
    prev ? supabase.rpc("f_operational_totals", prev) : Promise.resolve({ data: null }),
    supabase.rpc("f_monthly_summary"),
    supabase.rpc("f_expense_by_cost_center", { ...range, p_limit: 100 }),
    supabase.rpc("f_expense_by_ledger", { ...range, p_limit: 100 }),
    supabase.rpc("f_expense_by_account", { ...range, p_limit: 100 }),
    supabase.rpc("f_revenue_by_type", { ...range, p_limit: 100 }),
    supabase.from("v_bank_balances").select("*").order("sort_order"),
    supabase.from("v_custody_balances").select("*").order("name"),
    supabase.from("v_debt_balances").select("*").order("remaining", { ascending: false }),
    supabase.from("v_cash_position").select("*").single(),
    supabase.from("settings").select("company_name, usd_rate").single(),
  ]);

  const totals = ((totalsRes.data as OperationalTotals[] | null)?.[0] ??
    {}) as OperationalTotals;
  const prevTotals = (prevTotalsRes.data as OperationalTotals[] | null)?.[0] ?? null;
  const monthly = (monthlyRes.data ?? []) as MonthlySummary[];
  const byCc = (byCcRes.data ?? []) as Breakdown[];
  const byLedger = (byLedgerRes.data ?? []) as Breakdown[];
  const byAccount = (byAccountRes.data ?? []) as Breakdown[];
  const revByType = (revByTypeRes.data ?? []) as Breakdown[];
  const banks = (banksRes.data ?? []) as BankBalance[];
  const custody = (custodyRes.data ?? []) as CustodyBalance[];
  const debts = (debtsRes.data ?? []) as DebtView[];
  const cash = (cashRes.data ?? {}) as CashPosition;
  const company = settingsRes.data?.company_name ?? "الشركة";
  const usdRate = Number(settingsRes.data?.usd_rate ?? 0);

  const openDebts = debts.filter((d) => d.state === "open" || d.state === "overdue");
  const revenue = Number(totals.revenue ?? 0);
  const expense = Number(totals.expense ?? 0);
  const net = Number(totals.net ?? 0);
  const realRevenue = Number(totals.revenue_excl_opening ?? 0);
  const margin = realRevenue > 0 ? (net / realRevenue) * 100 : null;
  const prevMargin =
    prevTotals && Number(prevTotals.revenue_excl_opening) > 0
      ? (Number(prevTotals.net) / Number(prevTotals.revenue_excl_opening)) * 100
      : null;

  const periodLabel =
    from || to
      ? `${from ? fmtDateLong(from) : "البداية"} — ${to ? fmtDateLong(to) : "النهاية"}`
      : "كل الفترات المسجَّلة";

  const showMonthly = monthly.length > 1;
  const sections: Section[] = [
    { id: "s-summary", label: "ملخص الأداء" },
    { id: "s-cash", label: "الموقف النقدي" },
    ...(showMonthly ? [{ id: "s-trend", label: "الاتجاه الشهري" }] : []),
    { id: "s-composition", label: "تركيب الإيراد والمصروف" },
    { id: "s-revenue", label: "الإيراد حسب النوع" },
    { id: "s-costcenter", label: "مراكز التكلفة" },
    { id: "s-ledger", label: "الأستاذ العام" },
    { id: "s-account", label: "أسماء الحسابات" },
    ...(custody.length ? [{ id: "s-custody", label: "العهد" }] : []),
    { id: "s-banks", label: "البنوك والخزائن" },
    ...(openDebts.length ? [{ id: "s-debts", label: "المديونيات" }] : []),
  ];

  // رقم القسم من موضعه في شريط التنقّل، فلا يختلف الرقمان أبدًا
  const idx = (id: string) => sections.findIndex((s) => s.id === id) + 1;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="التقارير"
          description="تقرير مالي شامل بفلتر فترة، قابل للتصدير إلى Excel أو PDF"
        >
          <PeriodFilter />
          <ExportButtons from={from} to={to} />
        </PageHeader>
      </div>

      <ReportNav sections={sections} />

      <div className="mt-6 space-y-6 print:mt-0 print:space-y-4">
        <ReportMasthead
          company={company}
          period={periodLabel}
          comparing={Boolean(prev)}
        />

        {/* شريط المؤشرات: أرقام التقرير الأساسية في سطر واحد */}
        <Card className="overflow-hidden p-0 print:break-inside-avoid">
          <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
            <KpiTile
              label="الإيراد التشغيلي"
              value={revenue}
              hint={`${num(totals.revenue_count)} قيد`}
              previous={prevTotals?.revenue}
              tone="positive"
            />
            <KpiTile
              label="المصروف التشغيلي"
              value={expense}
              hint={`${num(totals.expense_count)} قيد`}
              previous={prevTotals?.expense}
              invert
              tone="negative"
            />
            <KpiTile
              label="صافي التشغيل"
              value={net}
              hint="الإيراد ناقص المصروف"
              previous={prevTotals?.net}
              tone={net >= 0 ? "positive" : "negative"}
            />
            <KpiTile
              label="هامش الصافي"
              value={margin === null ? "—" : pct(margin)}
              hint="من الإيراد بدون الأرصدة الافتتاحية"
              suffix={margin === null ? undefined : ""}
            />
            <KpiTile
              label="المتاح بعد المديونيات"
              value={cash.available_after_debts}
              hint={`${openDebts.length} مديونية قائمة`}
              tone="primary"
            />
          </div>
          {prevMargin !== null && margin !== null && (
            <div className="flex items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
              هامش الفترة السابقة {pct(prevMargin)}
              <Delta current={margin} previous={prevMargin} />
            </div>
          )}
        </Card>

        <ReportSection
          id="s-summary"
          index={idx("s-summary")}
          title="ملخص الأداء التشغيلي"
          note="الإيراد يستثني التحويلات الداخلية، والمصروف يشمل ما أُنفق من العهد ويستثني صرفها ومرتجعها"
          flush
        >
          <Table>
            <TableBody>
              <SummaryRow
                label="الإيراد التشغيلي"
                value={revenue}
                note={`${num(totals.revenue_count)} قيد`}
                previous={prevTotals?.revenue}
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
                previous={prevTotals?.revenue_excl_opening}
                muted
              />
              <SummaryRow
                label="المصروف التشغيلي"
                value={expense}
                note={`${num(totals.expense_count)} قيد — يشمل المصروف من العهد`}
                previous={prevTotals?.expense}
                invert
              />
              <SummaryRow label="صافي التشغيل" value={net} previous={prevTotals?.net} strong />
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
              <SummaryRow label="مرتجع العهد" value={totals.custody_return_total} muted />
            </TableBody>
          </Table>
        </ReportSection>

        <ReportSection
          id="s-cash"
          index={idx("s-cash")}
          title="الموقف النقدي الحالي"
          note="أرقام لحظية لا تتأثر بفلتر الفترة — تُقرأ من أعلى لأسفل حتى الرقم الأخير"
          flush
        >
          <Table>
            <TableBody>
              <SummaryRow label="أرصدة البنوك والخزائن" value={cash.bank_total} />
              <SummaryRow
                label="العهد القائمة عند الموظفين"
                value={cash.custody_total}
                note="مال الشركة وإن كان في يد موظف"
              />
              <SummaryRow label="إجمالي النقدية" value={cash.total_cash} strong />
              <SummaryRow
                label="المديونيات المتبقية للموردين"
                value={cash.debts_outstanding}
                note={`${openDebts.length} مديونية قائمة — لم تخرج من الخزنة بعد`}
              />
              <SummaryRow
                label="المتاح بعد سداد كل المديونيات"
                value={cash.available_after_debts}
                strong
              />
            </TableBody>
          </Table>
          {Number(cash.usd_total ?? 0) !== 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              منها خزينة الدولار{" "}
              {usdRate > 0 && (
                <span className="num font-semibold text-foreground">
                  {usd(toUsd(cash.usd_total, usdRate))} نقدًا ={" "}
                </span>
              )}
              <Money value={cash.usd_total} currency={false} /> ج.م
              {usdRate > 0 && ` محسوبة بسعر صرف ${usdRate}`}
            </p>
          )}
        </ReportSection>

        {showMonthly && (
          <ReportSection
            id="s-trend"
            index={idx("s-trend")}
            title="الاتجاه الشهري"
            note="الأعمدة للإيراد والمصروف، والخط للصافي — لكل الشهور المسجَّلة بغض النظر عن الفلتر"
          >
            <MonthlyTrendChart data={monthly} />
            <div className="mt-4 -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الشهر</TableHead>
                    <TableHead className="text-end">الإيراد</TableHead>
                    <TableHead className="text-end">المصروف</TableHead>
                    <TableHead className="text-end">الصافي</TableHead>
                    <TableHead className="w-20 text-center">القيود</TableHead>
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
            </div>
          </ReportSection>
        )}

        <ReportSection
          id="s-composition"
          index={idx("s-composition")}
          title="تركيب الإيراد والمصروف"
          note="نظرة سريعة على أين يأتي المال وأين يذهب"
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">الإيراد حسب النوع</p>
              {revByType.length ? <CompositionChart data={revByType} /> : <Empty />}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">المصروف حسب مركز التكلفة</p>
              {byCc.length ? <CompositionChart data={byCc} /> : <Empty />}
            </div>
          </div>
        </ReportSection>

        <BreakdownSection
          id="s-revenue"
          index={idx("s-revenue")}
          title="الإيراد حسب النوع"
          unit="نوع الإيراد"
          rows={revByType}
          total={revenue}
          color="var(--positive)"
        />
        <BreakdownSection
          id="s-costcenter"
          index={idx("s-costcenter")}
          title="المصروف حسب مركز التكلفة"
          unit="مركز التكلفة"
          rows={byCc}
          total={expense}
          color="var(--chart-1)"
        />
        <BreakdownSection
          id="s-ledger"
          index={idx("s-ledger")}
          title="المصروف حسب الأستاذ العام"
          unit="حساب الأستاذ"
          rows={byLedger}
          total={expense}
          color="var(--chart-2)"
        />
        <BreakdownSection
          id="s-account"
          index={idx("s-account")}
          title="المصروف حسب اسم الحساب"
          unit="اسم الحساب"
          rows={byAccount}
          total={expense}
          color="var(--chart-3)"
        />

        {custody.length > 0 && (
          <ReportSection
            id="s-custody"
            index={idx("s-custody")}
            title="أرصدة العهد"
            note="الرصيد = افتتاحي العهدة + ما صُرف − ما أُنفق − ما رُدَّ"
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
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
                      <Money value={c.balance} currency={false} sign className="font-semibold" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>الإجمالي</TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(custody, "paid_out")} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(custody, "spent")} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(custody, "returned")} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(custody, "balance")} currency={false} sign />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </ReportSection>
        )}

        <ReportSection
          id="s-banks"
          index={idx("s-banks")}
          title="أرصدة البنوك والخزائن"
          note="الرصيد = الافتتاحي + الإيراد − المصروف (باستثناء المصروف من العهدة) + مرتجع العهد"
          flush
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البنك / الخزينة</TableHead>
                <TableHead className="text-end">الافتتاحي</TableHead>
                <TableHead className="text-end">صافي الحركة</TableHead>
                <TableHead className="text-end">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.name}
                    {b.is_usd && (
                      <Badge variant="secondary" className="ms-2 text-[10px]">
                        دولار
                      </Badge>
                    )}
                    {b.is_usd && usdRate > 0 && (
                      <span className="num ms-2 text-[11px] text-muted-foreground">
                        {usd(toUsd(b.balance, usdRate))} نقدًا
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={b.opening_balance} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={b.net_movement} currency={false} sign />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={b.balance} currency={false} sign className="font-semibold" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>الإجمالي</TableCell>
                <TableCell className="text-end">
                  <Money value={sum(banks, "opening_balance")} currency={false} />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={sum(banks, "net_movement")} currency={false} sign />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={cash.bank_total} currency={false} sign />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ReportSection>

        {openDebts.length > 0 && (
          <ReportSection
            id="s-debts"
            index={idx("s-debts")}
            title="المديونيات القائمة"
            note="المتبقي التزام لم يخرج من الخزنة بعد، وهو المخصوم من «المتاح بعد المديونيات»"
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead>المديونية</TableHead>
                  <TableHead className="text-end">الإجمالي</TableHead>
                  <TableHead className="text-end">المدفوع</TableHead>
                  <TableHead className="text-end">المتبقي</TableHead>
                  <TableHead className="w-36">نسبة السداد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openDebts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.creditor_name}</TableCell>
                    <TableCell className="max-w-56 truncate text-sm" title={d.description ?? ""}>
                      {d.description}
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={d.total_amount} currency={false} />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={d.paid_amount} currency={false} />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={d.remaining} currency={false} className="font-semibold" />
                    </TableCell>
                    <TableCell>
                      <ShareBar
                        value={Number(d.paid_pct ?? 0)}
                        color={d.state === "overdue" ? "var(--negative)" : "var(--positive)"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>الإجمالي</TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(openDebts, "total_amount")} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(openDebts, "paid_amount")} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={sum(openDebts, "remaining")} currency={false} />
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </ReportSection>
        )}

        <p className="pb-2 text-center text-[11px] text-muted-foreground">
          {company} — تقرير آلي من نظام الإيرادات والمصروفات. الأرقام بالجنيه المصري على
          الأساس النقدي.
        </p>
      </div>
    </>
  );
}

/** ترويسة التقرير — تظهر على الشاشة وفي أعلى المستند المطبوع */
function ReportMasthead({
  company,
  period,
  comparing,
}: {
  company: string;
  period: string;
  comparing: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-chart-2/70 p-0 text-white shadow-xl shadow-primary/20 print:bg-white print:text-black">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -start-12 size-64 rounded-full bg-white/20 blur-3xl animate-aurora print:hidden"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white/80 print:text-black/60">
            <Building2 className="size-4" />
            {company}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            التقرير المالي الشامل
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/85 print:text-black/70">
            <CalendarRange className="size-4" />
            {period}
          </p>
        </div>
        <div className="space-y-1.5 text-end text-xs text-white/75 print:text-black/60">
          <p className="flex items-center justify-end gap-1.5">
            <Clock className="size-3.5" />
            صُدر في {fmtDateLong(new Date().toISOString())}
          </p>
          {comparing ? (
            <Badge className="border-0 bg-white/20 text-white print:hidden">
              مقارنة بالفترة السابقة المكافئة
            </Badge>
          ) : (
            <p className="print:hidden">حدّد فترة لتظهر المقارنة بالفترة السابقة</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function sum<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

function SummaryRow({
  label,
  value,
  note,
  previous,
  invert,
  strong,
  muted,
}: {
  label: string;
  value: number | string | null | undefined;
  note?: string;
  previous?: number | string | null;
  invert?: boolean;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <TableRow className={strong ? "bg-primary/[0.06] font-semibold" : ""}>
      <TableCell className={muted ? "text-muted-foreground" : ""}>
        {label}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </TableCell>
      <TableCell className="w-32 text-end print:hidden">
        {previous !== undefined && previous !== null && (
          <Delta current={value} previous={previous} invert={invert} />
        )}
      </TableCell>
      <TableCell className="w-44 text-end">
        <Money value={value} currency={false} sign={strong} />
      </TableCell>
    </TableRow>
  );
}

/** قسم تفصيلي: جدول بنود مع شريط نسبة وإجمالي */
function BreakdownSection({
  id,
  index,
  title,
  unit,
  rows,
  total,
  color,
}: {
  id: string;
  index: number;
  title: string;
  unit: string;
  rows: Breakdown[];
  total: number;
  color: string;
}) {
  const listed = rows.reduce((s, r) => s + Number(r.total), 0);
  const top = rows.length ? Number(rows[0].total) : 0;

  return (
    <ReportSection
      id={id}
      index={index}
      title={title}
      note={
        rows.length
          ? `${num(rows.length)} بندًا — النسبة محسوبة من إجمالي ${
              total > 0 ? egp(total) : "الفترة"
            }`
          : undefined
      }
      flush
    >
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{unit}</TableHead>
              <TableHead className="w-16 text-center">القيود</TableHead>
              <TableHead className="w-40 text-end">الإجمالي</TableHead>
              <TableHead className="w-32">النسبة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="max-w-72 truncate font-medium" title={r.name}>
                  {r.name}
                </TableCell>
                <TableCell className="num text-center text-xs text-muted-foreground">
                  {r.cnt}
                </TableCell>
                <TableCell className="text-end">
                  <Money value={r.total} currency={false} />
                </TableCell>
                <TableCell>
                  <ShareBar
                    value={total > 0 ? (Number(r.total) / total) * 100 : 0}
                    color={
                      top > 0 && Number(r.total) === top ? color : `color-mix(in oklab, ${color} 55%, transparent)`
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>إجمالي البنود المعروضة</TableCell>
              <TableCell className="num text-center text-xs">
                {num(rows.reduce((s, r) => s + Number(r.cnt), 0))}
              </TableCell>
              <TableCell className="num text-end">{egp(listed)}</TableCell>
              <TableCell className="num text-xs text-muted-foreground">
                {total > 0 ? pct((listed / total) * 100) : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </ReportSection>
  );
}

function Empty() {
  return (
    <p className="grid h-32 place-items-center text-sm text-muted-foreground">
      لا توجد بيانات في هذه الفترة
    </p>
  );
}

export const revalidate = 0;
