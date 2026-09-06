import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Money } from "@/components/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { egp, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** قسم مرقَّم في التقرير، لا ينقسم بين صفحتين عند الطباعة */
export function ReportSection({
  id,
  index,
  title,
  note,
  action,
  flush,
  children,
}: {
  id: string;
  index: number;
  title: string;
  note?: string;
  action?: React.ReactNode;
  /** بلا حشو داخلي — للأقسام التي محتواها جدول بعرض كامل */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      id={id}
      className="scroll-mt-24 break-inside-avoid print:break-inside-auto print:shadow-none"
    >
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="num mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20">
            {index}
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {note && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {note}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 print:hidden">{action}</div>}
      </CardHeader>
      <CardContent className={flush ? "p-0" : undefined}>{children}</CardContent>
    </Card>
  );
}

/** فرق النسبة عن الفترة السابقة */
export function Delta({
  current,
  previous,
  /** المصروف: الزيادة سيئة، فنعكس اللون */
  invert = false,
}: {
  current: number | string | null | undefined;
  previous: number | string | null | undefined;
  invert?: boolean;
}) {
  const now = Number(current ?? 0);
  const before = Number(previous ?? 0);

  if (Math.abs(before) < 0.005) {
    return <span className="text-[11px] text-muted-foreground">لا مقارنة</span>;
  }

  const change = ((now - before) / Math.abs(before)) * 100;
  const flat = Math.abs(change) < 0.05;
  const up = change > 0;
  const good = invert ? !up : up;
  const Icon: LucideIcon = flat ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        flat
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-positive/10 text-positive"
            : "bg-negative/10 text-negative"
      )}
      title={`الفترة السابقة: ${egp(before)}`}
    >
      <Icon className="size-3" />
      <span className="num">
        {up && !flat ? "+" : ""}
        {pct(change)}
      </span>
    </span>
  );
}

/** بطاقة مؤشر في شريط التقرير، مع مقارنة اختيارية */
export function KpiTile({
  label,
  value,
  hint,
  previous,
  invert,
  tone = "neutral",
  suffix,
}: {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  previous?: number | string | null;
  invert?: boolean;
  tone?: "neutral" | "positive" | "negative" | "primary";
  suffix?: string;
}) {
  const TONE = {
    neutral: "text-foreground",
    positive: "text-positive",
    negative: "text-negative",
    primary: "text-primary",
  } as const;

  return (
    <div className="border-e border-border/60 px-4 py-3 last:border-e-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tracking-tight", TONE[tone])}>
        {typeof value === "string" ? (
          <span className="num">{value}</span>
        ) : (
          <Money value={value} currency={false} />
        )}
        {suffix && <span className="ms-1 text-xs font-normal opacity-60">{suffix}</span>}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {previous !== undefined && previous !== null && (
          <Delta current={typeof value === "string" ? 0 : value} previous={previous} invert={invert} />
        )}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

/** شريط نسبة داخل خلية الجدول — يجعل توزيع البنود مقروءًا بنظرة */
export function ShareBar({ value, color }: { value: number; color?: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted print:hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color ?? "var(--chart-1)" }}
        />
      </div>
      <span className="num w-11 text-end text-xs text-muted-foreground">
        {pct(value)}
      </span>
    </div>
  );
}
