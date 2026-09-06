import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: {
    chip: "from-secondary to-secondary/60 text-secondary-foreground",
    glow: "bg-foreground/5",
  },
  primary: {
    chip: "from-primary/20 to-primary/5 text-primary",
    glow: "bg-primary/10",
  },
  positive: {
    chip: "from-positive/20 to-positive/5 text-positive",
    glow: "bg-positive/10",
  },
  negative: {
    chip: "from-negative/20 to-negative/5 text-negative",
    glow: "bg-negative/10",
  },
  warning: {
    chip: "from-warning/25 to-warning/5 text-warning",
    glow: "bg-warning/10",
  },
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
  const t = TONES[tone];

  return (
    <Card className="lift group relative gap-0 overflow-hidden p-4">
      {/* هالة لونية خفيفة في الزاوية تتضح عند المرور */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-12 -end-10 size-32 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 md:opacity-60",
          t.glow
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ring-white/40 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10",
              t.chip
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>

      <p className="relative mt-2 text-2xl font-bold tracking-tight">
        {typeof value === "string" ? (
          value
        ) : (
          <Money value={value} sign={sign} currency={currency} />
        )}
      </p>

      {hint && (
        <p className="relative mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </Card>
  );
}
