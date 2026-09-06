"use client";

import { CalendarRange } from "lucide-react";
import { useFilters } from "@/components/filter-bar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { monthStart, today } from "@/lib/format";

const PRESETS = [
  { id: "all", label: "كل الفترات" },
  { id: "month", label: "الشهر الحالي" },
  { id: "custom", label: "فترة محددة" },
] as const;

/** فلتر الفترة المشترك بين لوحة المعلومات والتقارير */
export function PeriodFilter() {
  const { get, set } = useFilters();
  const from = get("from");
  const to = get("to");
  const custom = Boolean(from || to);
  const isMonth = from === monthStart() && to === today();
  const active = isMonth ? "month" : custom ? "custom" : "all";

  function pick(id: (typeof PRESETS)[number]["id"]) {
    if (id === "all") set({ from: null, to: null });
    else if (id === "month") set({ from: monthStart(), to: today() });
    else set({ from: monthStart(), to: today() });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-muted p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === p.id
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {active === "custom" && (
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <Input
            type="date"
            aria-label="من تاريخ"
            className="h-9 w-36"
            value={from}
            onChange={(e) => set({ from: e.target.value || null })}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            aria-label="إلى تاريخ"
            className="h-9 w-36"
            value={to}
            onChange={(e) => set({ to: e.target.value || null })}
          />
          <Button variant="ghost" size="sm" onClick={() => set({ from: null, to: null })}>
            إلغاء
          </Button>
        </div>
      )}
    </div>
  );
}
