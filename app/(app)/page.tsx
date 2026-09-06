import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  HandCoins,
  Landmark,
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
import { CUSTODY_STATE_LABELS, egp, fmtDate, num, toUsd, usd } from "@/lib/format";
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

      <div className="rise-stagger space-y-6">
        <CashPositionCard cash={cash} usdRate={usdRate} />

        <BankTiles
          banks={banks}
          total={Number(cash.bank_total ?? 0)}
          usdRate={usdRate}
        />

        <div className="rise-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                  <TableRow>
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
        "relative overflow-hidden border-0 bg-gradient-to-br p-0 text-white shadow-xl",
        available >= 0
          ? "from-primary via-primary/85 to-chart-2/70 shadow-primary/25"
          : "from-negative via-negative/85 to-warning/60 shadow-negative/25"
      )}
    >
      {/* هالتان تعطيان البطاقة عمقًا زجاجيًا */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -start-16 size-72 rounded-full bg-white/20 blur-3xl animate-aurora"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -end-10 size-72 rounded-full bg-white/10 blur-3xl animate-aurora"
        style={{ animationDelay: "-13s" }}
      />

      <div className="relative grid gap-6 p-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-white/75">
            المتاح بعد سداد كل المديونيات
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
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

        <div className="space-y-1.5 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-inner backdrop-blur-md lg:col-span-3">
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
            <p className="pt-2 text-[11px] text-white/70">
              منها خزينة الدولار{" "}
              {usdRate > 0 && (
                <span className="num font-semibold text-white">
                  {usd(toUsd(cash.usd_total, usdRate))} نقدًا
                </span>
              )}{" "}
              = <Money value={cash.usd_total} currency={false} /> ج.م
              {usdRate > 0 && ` بسعر صرف ${usdRate}`}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** الخزائن تُميَّز بالاسم كما تُميَّز مراكز العهد، فلا عمود لها في القاعدة */
const isTreasury = (name: string) => /^(خزينة|خزنة|خزنه)/.test(name.trim());

/** مربع لكل بنك وخزينة: الرصيد أبرز رقم، وشريط يوضّح وزنه من الإجمالي */
function BankTiles({
  banks,
  total,
  usdRate,
}: {
  banks: BankBalance[];
  total: number;
  usdRate: number;
}) {
  if (banks.length === 0) return null;

  const ordered = [...banks].sort(
    (a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance))
  );
  const largest = Math.max(...ordered.map((b) => Math.abs(Number(b.balance))), 1);
  const treasuries = banks.filter((b) => isTreasury(b.name)).length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Banknote className="size-[18px] text-muted-foreground" />
            أرصدة البنوك والخزائن
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            البنوك {num(banks.length - treasuries)} · الخزائن {num(treasuries)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end">
            <p className="text-[11px] text-muted-foreground">الإجمالي</p>
            <p className="text-xl font-bold tracking-tight">
              <Money value={total} currency={false} sign />
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                ج.م
              </span>
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/banks">إدارة الحسابات</Link>
          </Button>
        </div>
      </div>

      <div className="rise-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {ordered.map((bank) => (
          <BankTile
            key={bank.id}
            bank={bank}
            largest={largest}
            usdRate={usdRate}
          />
        ))}
      </div>
    </section>
  );
}

function BankTile({
  bank,
  largest,
  usdRate,
}: {
  bank: BankBalance;
  largest: number;
  usdRate: number;
}) {
  const balance = Number(bank.balance ?? 0);
  const movement = Number(bank.net_movement ?? 0);
  const treasury = isTreasury(bank.name);
  const Icon = treasury ? Wallet : Landmark;
  const idle = Math.abs(balance) < 0.005;
  // خزينة الدولار: المال محفوظ نقدًا بالدولار والمسجَّل مقابله بالجنيه
  const cashUsd = bank.is_usd && usdRate > 0 ? toUsd(balance, usdRate) : null;

  return (
    <Card
      className={cn(
        "lift relative gap-0 overflow-hidden p-4",
        idle && "border-dashed opacity-70"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          balance < 0
            ? "bg-negative"
            : treasury
              ? "bg-chart-2"
              : "bg-primary"
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-current/10",
            treasury ? "bg-chart-2/10 text-chart-2" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        {bank.is_usd && (
          <Badge variant="secondary" className="text-[10px]">
            دولار
          </Badge>
        )}
      </div>

      <p
        title={bank.name}
        className="mt-3 line-clamp-2 min-h-8 text-sm font-medium leading-tight"
      >
        {bank.name}
      </p>

      <p className="mt-1 text-xl font-bold tracking-tight">
        <Money
          value={balance}
          currency={false}
          className={cn(balance < 0 && "text-negative")}
        />
      </p>

      {cashUsd !== null && (
        <p
          title={`محسوب على سعر صرف ${usdRate}`}
          className="num mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-sm font-semibold text-primary"
        >
          {usd(cashUsd)}
          <span className="text-[10px] font-normal opacity-70">نقدًا</span>
        </p>
      )}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full",
            treasury ? "bg-chart-2/70" : "bg-primary/70"
          )}
          style={{ width: `${(Math.abs(balance) / largest) * 100}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{num(bank.entry_count)} قيد</span>
        {idle ? (
          <span>بلا حركة</span>
        ) : (
          <span
            className={cn(
              "num inline-flex items-center gap-0.5 font-medium",
              movement >= 0 ? "text-positive" : "text-negative"
            )}
          >
            {movement >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {egp(Math.abs(movement))}
          </span>
        )}
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
    <Card className="lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            aria-hidden
            className="size-2.5 rounded-full ring-4 ring-current/10"
            style={{ background: color }}
          />
          {title}
        </CardTitle>
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
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-current/15",
        tone
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
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
