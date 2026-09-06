"use client";

import { useState } from "react";
import { AlertTriangle, HandCoins, Receipt, Undo2 } from "lucide-react";
import { EntryForm } from "@/components/entry-form";
import { Money } from "@/components/money";
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
import type { CustodyBalance, EntryView, MovementType } from "@/lib/database.types";
import type { Lookups } from "@/lib/lookups";
import type { EntryInput } from "@/lib/schemas";
import { CUSTODY_STATE_LABELS, MOVEMENT_LABELS, fmtDate, today } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATE_TONE = {
  settled: "bg-positive/10 text-positive",
  outstanding: "bg-warning/15 text-warning",
  negative: "bg-destructive/10 text-destructive",
} as const;

export function CustodyView({
  custody,
  moves,
  lookups,
  orphanCount,
}: {
  custody: CustodyBalance[];
  moves: EntryView[];
  lookups: Lookups;
  orphanCount: number;
}) {
  const [preset, setPreset] = useState<Partial<EntryInput> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  function record(movement: MovementType, custodyRow?: CustodyBalance) {
    setPreset({
      kind: "expense",
      movement_type: movement,
      entry_date: today(),
      cost_center_id: custodyRow?.id ?? null,
      bank_id: null,
      amount: "" as unknown as number,
      description:
        movement === "custody_out"
          ? `صرف عهدة${custodyRow ? ` — ${custodyRow.name}` : ""}`
          : movement === "custody_expense"
            ? "مصروف من العهدة"
            : "مرتجع عهدة",
    });
  }

  const filtered = selected ? moves.filter((m) => m.cost_center_id === selected) : moves;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => record("custody_out")}>
          <HandCoins className="size-4" />
          صرف عهدة
        </Button>
        <Button variant="secondary" onClick={() => record("custody_expense")}>
          <Receipt className="size-4" />
          مصروف من عهدة
        </Button>
        <Button variant="outline" onClick={() => record("custody_return")}>
          <Undo2 className="size-4" />
          مرتجع عهدة
        </Button>
      </div>

      {orphanCount > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-warning" />
            <p className="text-sm">
              <span className="font-medium">
                {orphanCount} حركة عهدة بلا مركز تكلفة
              </span>{" "}
              — لن تظهر في رصيد أي عهدة حتى تُحدَّد. راجعها من صفحة المراجعة.
            </p>
          </CardContent>
        </Card>
      )}

      {custody.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="font-medium">لا توجد مراكز عهد</p>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف مركز تكلفة يبدأ اسمه بكلمة «عهد» من صفحة إدارة القوائم — مثل «عهدة
            جويلي» — ليتحول تلقائيًا إلى عهدة لها رصيد مستقل.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scroll-slim overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="min-w-40">العهدة</TableHead>
                  <TableHead className="w-28 text-end">الافتتاحي</TableHead>
                  <TableHead className="w-28 text-end">صُرف</TableHead>
                  <TableHead className="w-28 text-end">أُنفق</TableHead>
                  <TableHead className="w-28 text-end">رُدَّ</TableHead>
                  <TableHead className="w-32 text-end">الرصيد القائم</TableHead>
                  <TableHead className="w-24">الحالة</TableHead>
                  <TableHead className="w-24">آخر حركة</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custody.map((c) => (
                  <TableRow
                    key={c.id}
                    className={cn(
                      "cursor-pointer",
                      selected === c.id && "bg-accent/50"
                    )}
                    onClick={() => setSelected(selected === c.id ? null : c.id)}
                  >
                    <TableCell className="font-medium">
                      {c.name}
                      {c.custody_holder && (
                        <span className="block text-xs text-muted-foreground">
                          {c.custody_holder}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={c.custody_opening} currency={false} />
                    </TableCell>
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
                      <Money
                        value={c.balance}
                        currency={false}
                        className="font-semibold"
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-medium",
                          STATE_TONE[c.state]
                        )}
                      >
                        {CUSTODY_STATE_LABELS[c.state]}
                      </span>
                    </TableCell>
                    <TableCell className="num text-xs">
                      {fmtDate(c.last_movement)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            record("custody_expense", c);
                          }}
                        >
                          مصروف
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            record("custody_return", c);
                          }}
                        >
                          تصفية
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            حركات العهد
            {selected && (
              <Badge variant="secondary" className="ms-2">
                {custody.find((c) => c.id === selected)?.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              لا توجد حركات عهد
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-28">رقم القيد</TableHead>
                  <TableHead className="w-24">التاريخ</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead className="w-36">العهدة</TableHead>
                  <TableHead className="w-32">الحركة</TableHead>
                  <TableHead className="w-32">البنك</TableHead>
                  <TableHead className="w-32 text-end">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="num text-xs text-muted-foreground">
                      {m.entry_code}
                    </TableCell>
                    <TableCell className="num text-xs">{fmtDate(m.entry_date)}</TableCell>
                    <TableCell className="text-sm">{m.description || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {m.cost_center_name ?? (
                        <span className="text-warning">غير محدد</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">
                        {MOVEMENT_LABELS[m.movement_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{m.bank_name ?? "—"}</TableCell>
                    <TableCell className="text-end">
                      <Money value={m.amount} currency={false} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EntryForm
        open={Boolean(preset)}
        onOpenChange={(open) => !open && setPreset(null)}
        lookups={lookups}
        preset={preset ?? undefined}
      />
    </div>
  );
}
