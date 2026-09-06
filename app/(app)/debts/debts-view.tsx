"use client";

import { Fragment, useState } from "react";
import {
  Ban,
  ChevronDown,
  CirclePlus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteDebt, setDebtStatus } from "@/app/actions/debts";
import { EntryForm } from "@/components/entry-form";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DebtView, EntryView } from "@/lib/database.types";
import type { Lookups } from "@/lib/lookups";
import type { EntryInput } from "@/lib/schemas";
import { DEBT_STATE_LABELS, fmtDate, pct, today } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DebtForm } from "./debt-form";

const STATE_TONE = {
  open: "bg-primary/10 text-primary",
  overdue: "bg-warning/15 text-warning",
  settled: "bg-positive/10 text-positive",
  cancelled: "bg-muted text-muted-foreground",
} as const;

export function DebtsView({
  debts,
  payments,
  lookups,
  settledCount,
}: {
  debts: DebtView[];
  payments: EntryView[];
  lookups: Lookups;
  settledCount: number;
}) {
  const [debtForm, setDebtForm] = useState<{ open: boolean; debt: DebtView | null }>({
    open: false,
    debt: null,
  });
  const [payment, setPayment] = useState<Partial<EntryInput> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const visible = showSettled
    ? debts
    : debts.filter((d) => d.state === "open" || d.state === "overdue");

  function openPayment(debt: DebtView) {
    setPayment({
      kind: "expense",
      movement_type: "operational",
      entry_date: today(),
      description: `دفعة — ${debt.description}`,
      debt_id: debt.id,
      account_id: debt.account_id,
      ledger_id: debt.ledger_id,
      cost_center_id: debt.cost_center_id,
      amount: "" as unknown as number,
    });
  }

  async function remove(debt: DebtView) {
    if (
      !confirm(
        `حذف المديونية «${debt.description}»؟ الدفعات المسجَّلة ستبقى قيود مصروف لكن بلا ربط.`
      )
    )
      return;
    const result = await deleteDebt(debt.id);
    toast[result.ok ? "success" : "error"](
      result.ok ? "تم حذف المديونية" : result.error
    );
  }

  async function toggleCancel(debt: DebtView) {
    const next = debt.status === "cancelled" ? "open" : "cancelled";
    const result = await setDebtStatus(debt.id, next);
    toast[result.ok ? "success" : "error"](
      result.ok
        ? next === "cancelled"
          ? "تم إلغاء المديونية"
          : "تمت إعادة تفعيل المديونية"
        : result.error
    );
  }

  return (
    <div className="rise space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDebtForm({ open: true, debt: null })}>
          <Plus className="size-4" />
          مديونية جديدة
        </Button>
        {settledCount > 0 && (
          <Button variant="outline" onClick={() => setShowSettled((v) => !v)}>
            {showSettled ? "إخفاء المسددة والملغاة" : `عرض المسددة (${settledCount})`}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="font-medium">لا توجد مديونيات مسجَّلة</p>
          <p className="mt-1 text-sm text-muted-foreground">
            عندما يتفق مورد على مبلغ ولم يُدفع كاملًا، سجّله هنا ليُخصم المتبقي من
            المتاح
          </p>
          <Button
            className="mt-4"
            onClick={() => setDebtForm({ open: true, debt: null })}
          >
            <Plus className="size-4" />
            تسجيل أول مديونية
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scroll-slim overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="min-w-56">المورد والمديونية</TableHead>
                  <TableHead className="w-32 text-end">الإجمالي</TableHead>
                  <TableHead className="w-32 text-end">المدفوع</TableHead>
                  <TableHead className="w-32 text-end">المتبقي</TableHead>
                  <TableHead className="w-40">نسبة السداد</TableHead>
                  <TableHead className="w-24">الاستحقاق</TableHead>
                  <TableHead className="w-24">الحالة</TableHead>
                  <TableHead className="w-44"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((debt) => {
                  const rows = payments.filter((p) => p.debt_id === debt.id);
                  const isOpen = expanded === debt.id;
                  return (
                    <Fragment key={debt.id}>
                      <TableRow
                        className={cn(debt.state === "cancelled" && "opacity-50")}
                      >
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : debt.id)}
                            className="flex items-start gap-2 text-start"
                          >
                            <ChevronDown
                              className={cn(
                                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180"
                              )}
                            />
                            <span>
                              <span className="block font-medium">
                                {debt.creditor_name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {debt.description}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {debt.cost_center_name ?? "بلا مركز تكلفة"} ·{" "}
                                {debt.payment_count} دفعة
                              </span>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="text-end">
                          <Money value={debt.total_amount} currency={false} />
                        </TableCell>
                        <TableCell className="text-end">
                          <Money
                            value={debt.paid_amount}
                            currency={false}
                            className="text-positive"
                          />
                        </TableCell>
                        <TableCell className="text-end">
                          <Money
                            value={debt.remaining}
                            currency={false}
                            className="font-semibold text-negative"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(100, Number(debt.paid_pct))}
                              className="h-2"
                            />
                            <span className="num shrink-0 text-xs text-muted-foreground">
                              {pct(debt.paid_pct)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="num text-xs">
                          {fmtDate(debt.due_date)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-medium",
                              STATE_TONE[debt.state]
                            )}
                          >
                            {DEBT_STATE_LABELS[debt.state]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {(debt.state === "open" || debt.state === "overdue") && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openPayment(debt)}
                              >
                                <CirclePlus className="size-3.5" />
                                سجّل دفعة
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label="تعديل"
                              onClick={() => setDebtForm({ open: true, debt })}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={
                                debt.status === "cancelled" ? "إعادة تفعيل" : "إلغاء"
                              }
                              onClick={() => toggleCancel(debt)}
                            >
                              {debt.status === "cancelled" ? (
                                <RotateCcw className="size-3.5" />
                              ) : (
                                <Ban className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              aria-label="حذف"
                              onClick={() => remove(debt)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {isOpen && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4">
                              <p className="mb-2 text-sm font-medium">
                                دفعات هذه المديونية
                              </p>
                              {rows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  لم تُسجَّل أي دفعة بعد — كامل المبلغ ما زال
                                  التزامًا لم يمسّ الخزنة
                                </p>
                              ) : (
                                <div className="overflow-hidden rounded-lg border bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-28">رقم القيد</TableHead>
                                        <TableHead className="w-24">التاريخ</TableHead>
                                        <TableHead>البيان</TableHead>
                                        <TableHead className="w-40">من</TableHead>
                                        <TableHead className="w-32 text-end">
                                          المبلغ
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {rows.map((p) => (
                                        <TableRow key={p.id}>
                                          <TableCell className="num text-xs text-muted-foreground">
                                            {p.entry_code}
                                          </TableCell>
                                          <TableCell className="num text-xs">
                                            {fmtDate(p.entry_date)}
                                          </TableCell>
                                          <TableCell className="text-sm">
                                            {p.description}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {p.bank_name ?? "—"}
                                          </TableCell>
                                          <TableCell className="text-end">
                                            <Money value={p.amount} currency={false} />
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              {debt.note && (
                                <p className="mt-3 text-xs text-muted-foreground">
                                  ملاحظات: {debt.note}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <DebtForm
        open={debtForm.open}
        onOpenChange={(open) => setDebtForm((s) => ({ ...s, open }))}
        lookups={lookups}
        debt={debtForm.debt}
      />

      <EntryForm
        open={Boolean(payment)}
        onOpenChange={(open) => !open && setPayment(null)}
        lookups={lookups}
        preset={payment ?? undefined}
      />
    </div>
  );
}
