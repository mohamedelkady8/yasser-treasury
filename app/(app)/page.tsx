import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  HandCoins,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import {
  BreakdownChart,
  DailyMovementChart,
  RevenueTypeChart,
} from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CUSTODY_STATE_LABELS, egp, fmtDate, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BankBalance,
  Breakdown,
  CashPosition,
  CustodyBalance,
  DailyMovement,
  OperationalTotals,
} from "@/lib/database.types";

export const metadata = { title: "لوحة المعلومات" };

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
  const s = (Array.isArray(v) ? v[0] : v) ?? "";
  return s || null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const range = { p_from: one(sp.from), p_to: one(sp.to) };

  const supabase = await createClient();

  const [
    cashRes,
    totalsRes,
    banksRes,
    custodyRes,
    revByTypeRes,
    byCostCenterRes,
    byLedgerRes,
    byAccountRes,
    dailyRes,
    issuesRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from("v_cash_position").select("*").single(),
    supabase.rpc("f_operational_totals", range),
    supabase.from("v_bank_balances").select("*").order("sort_order"),
    supabase.from("v_custody_balances").select("*").order("balance", { ascending: false }),
    supabase.rpc("f_revenue_by_type", { ...range, p_limit: 8 }),
    supabase.rpc("f_expense_by_cost_center", { ...range, p_limit: 10 }),
    supabase.rpc("f_expense_by_ledger", { ...range, p_limit: 10 }),
    supabase.rpc("f_expense_by_account", { ...range, p_limit: 10 }),
    supabase.rpc("f_daily_movement", range),
    supabase.from("v_entry_issues").select("id", { count: "exact", head: true }),
    supabase.from("settings").select("usd_rate").single(),
  ]);

  const cash = (cashRes.data ?? {}) as CashPosition;
  const totals = ((totalsRes.data as OperationalTotals[] | null)?.[0] ??
    {}) as OperationalTotals;
  const banks = (banksRes.data ?? []) as BankBalance[];
  const custody = (custodyRes.data ?? []) as CustodyBalance[];
  const revenueByType = (revByTypeRes.data ?? []) as Breakdown[];
  const byCostCenter = (byCostCenterRes.data ?? []) as Breakdown[];
  const byLedger = (byLedgerRes.data ?? []) as Breakdown[];
  const byAccount = (byAccountRes.data ?? []) as Breakdown[];
  const daily = (dailyRes.data ?? []) as DailyMovement[];
  const issueCount = issuesRes.count ?? 0;
  const usdRate = Number(settingsRes.data?.usd_rate ?? 0);

  const outstandingCustody = custody.filter((c) => c.state !== "settled");

  return (
    <>
      <PageHeader title="لوحة المعلومات" description="صورة كاملة للموقف المالي">
        <PeriodFilter />
      </PageHeader>

      <div className="space-y-6">
        <CashPositionCard cash={cash} usdRate={usdRate} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="الإيراد التشغيلي"
            value={totals.revenue}
            hint={`${num(totals.revenue_count)} قيد — منها أرصدة افتتاحية ${egp(totals.opening_balances)}`}
            icon={TrendingUp}
            tone="positive"
          />
          <StatCard
            label="المصروف التشغيلي"
            value={totals.expense}
            hint={`${num(totals.expense_count)} قيد — يشمل المصروف من العهد`}
            icon={TrendingDown}
            tone="negative"
          />
          <StatCard
            label="صافي التشغيل"
            value={totals.net}
            hint="الإيراد ناقص المصروف التشغيلي"
            icon={Wallet}
            tone={Number(totals.net) >= 0 ? "positive" : "negative"}
            sign
          />
          <StatCard
            label="التحويلات الداخلية"
            value={totals.internal_transfers}
            hint="لا تُحسب في الإيراد أو المصروف"
            icon={ArrowLeftRight}
            tone="primary"
          />
        </div>

        {issueCount > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-warning/15 text-warning">
                  <ShieldAlert className="size-[18px]" />
                </span>
                <div>
                  <p className="font-medium">
                    {num(issueCount)} قيد يحتاج مراجعة
                  </p>
                  <p className="text-xs text-muted-foreground">
                    بيانات ناقصة أو حركات عهد بلا مركز تكلفة
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/review">فتح صفحة المراجعة</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>الحركة اليومية</CardTitle>
            </CardHeader>
            <CardContent>
              {daily.length ? (
                <DailyMovementChart data={daily} />
              ) : (
                <Empty />
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>الإيراد حسب النوع</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByType.length ? (
                <RevenueTypeChart data={revenueByType} />
              ) : (
                <Empty />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="size-4 text-muted-foreground" />
                أرصدة البنوك والخزائن
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>البنك / الخزينة</TableHead>
                    <TableHead className="text-end">حركة الشهر</TableHead>
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
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={b.net_movement} currency={false} sign />
                      </TableCell>
                      <TableCell className="text-end">
                        <Money
                          value={b.balance}
                          currency={false}
                          sign
                          className="font-semibold"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>الإجمالي</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-end">
                      <Money value={cash.bank_total} currency={false} sign />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="size-4 text-muted-foreground" />
                العهد
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {custody.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  لا توجد مراكز عهد — أضف مركز تكلفة يبدأ اسمه بكلمة «عهد»
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>العهدة</TableHead>
                      <TableHead className="text-end">صُرف</TableHead>
                      <TableHead className="text-end">أُنفق</TableHead>
                      <TableHead className="text-end">الرصيد</TableHead>
                      <TableHead>الحالة</TableHead>
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
                          <Money
                            value={c.balance}
                            currency={false}
                            className="font-semibold"
                          />
                        </TableCell>
                        <TableCell>
                          <CustodyBadge state={c.state} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <TopCard title="أعلى 10 مراكز تكلفة" data={byCostCenter} color="var(--chart-1)" />
          <TopCard title="أعلى 10 حسابات الأستاذ العام" data={byLedger} color="var(--chart-2)" />
          <TopCard title="أعلى 10 حسابات" data={byAccount} color="var(--chart-3)" />
        </div>

        {outstandingCustody.length > 0 && (
          <p className="text-xs text-muted-foreground">
            آخر حركة عهدة:{" "}
            {fmtDate(
              outstandingCustody
                .map((c) => c.last_movement)
                .filter(Boolean)
                .sort()
                .at(-1)
            )}
          </p>
        )}
      </div>
    </>
  );
}

function CashPositionCard({
  cash,
  usdRate,
}: {
  cash: CashPosition;
  usdRate: number;
}) {
  const available = Number(cash.available_after_debts ?? 0);
  const rows = [
    { label: "أرصدة البنوك والخزائن", value: cash.bank_total, op: "" },
    {
      label: "العهد القائمة عند الموظفين",
      value: cash.custody_total,
      op: "+",
      hint: "مال الشركة وإن كان في يد موظف",
    },
    { label: "إجمالي النقدية", value: cash.total_cash, op: "=", strong: true },
    {
      label: "المديونيات المتبقية للموردين",
      value: cash.debts_outstanding,
      op: "−",
      hint: "لم تخرج من الخزنة بعد",
    },
  ];

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 bg-gradient-to-br p-0 text-white shadow-lg",
        available >= 0
          ? "from-primary to-primary/70 shadow-primary/20"
          : "from-negative to-negative/70 shadow-negative/20"
      )}
    >
      <div className="grid gap-6 p-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-white/75">
            المتاح بعد سداد كل المديونيات
          </p>
          <p className="mt-2 text-3xl font-bold sm:text-4xl">
            <Money value={available} currency={false} />
            <span className="ms-2 text-base font-normal text-white/70">ج.م</span>
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/70">
            هذا هو الرقم الذي يُقال لصاحب الشركة عند سؤاله «معايا كام». النقدية في
            الخزنة أعلى من ذلك، لكن جزءًا منها مرتبط بالتزامات لم تُدفع بعد.
          </p>
          {Number(cash.overdue_count ?? 0) > 0 && (
            <Badge className="mt-3 border-0 bg-white/20 text-white">
              {num(cash.overdue_count)} مديونية فات تاريخ استحقاقها
            </Badge>
          )}
        </div>

        <div className="space-y-1.5 rounded-xl bg-white/10 p-4 backdrop-blur lg:col-span-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className={cn(
                "flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm",
                r.strong && "bg-white/10 font-semibold"
              )}
            >
              <span className="flex items-baseline gap-2">
                <span className="w-3 shrink-0 text-white/60">{r.op}</span>
                <span>
                  {r.label}
                  {r.hint && (
                    <span className="block text-[11px] font-normal text-white/60">
                      {r.hint}
                    </span>
                  )}
                </span>
              </span>
              <Money value={r.value} currency={false} className="shrink-0" />
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between gap-3 rounded-lg bg-white/20 px-2 py-2 text-sm font-bold">
            <span className="flex items-baseline gap-2">
              <span className="w-3 shrink-0 text-white/60">=</span>
              المتاح فعليًا
            </span>
            <Money value={available} currency={false} className="shrink-0" />
          </div>
          {Number(cash.usd_total ?? 0) !== 0 && (
            <p className="pt-2 text-[11px] text-white/60">
              منها خزينة الدولار <Money value={cash.usd_total} currency={false} /> ج.م
              {usdRate > 0 && ` بسعر صرف ${usdRate}`}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function TopCard({
  title,
  data,
  color,
}: {
  title: string;
  data: Breakdown[];
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length ? <BreakdownChart data={data} color={color} /> : <Empty />}
      </CardContent>
    </Card>
  );
}

function CustodyBadge({ state }: { state: CustodyBalance["state"] }) {
  const tone =
    state === "settled"
      ? "bg-positive/10 text-positive"
      : state === "negative"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/15 text-warning";
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", tone)}>
      {CUSTODY_STATE_LABELS[state]}
    </span>
  );
}

function Empty() {
  return (
    <p className="grid h-40 place-items-center text-sm text-muted-foreground">
      لا توجد بيانات في هذه الفترة
    </p>
  );
}

export const revalidate = 0;
