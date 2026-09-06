import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/10 text-primary",
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
  warning: "bg-warning/15 text-warning",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  sign = false,
  currency = true,
}: {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  sign?: boolean;
  currency?: boolean;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONES[tone])}>
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold">
        {typeof value === "string" ? (
          value
        ) : (
          <Money value={value} sign={sign} currency={currency} />
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
