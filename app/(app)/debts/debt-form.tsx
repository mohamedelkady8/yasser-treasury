"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveDebt } from "@/app/actions/debts";
import { Combobox } from "@/components/combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { debtSchema, type DebtInput } from "@/lib/schemas";
import type { DebtView } from "@/lib/database.types";
import type { Lookups } from "@/lib/lookups";
import { today } from "@/lib/format";

function blank(): DebtInput {
  return {
    creditor_id: "",
    description: "",
    total_amount: "" as unknown as number,
    debt_date: today(),
    due_date: null,
    account_id: null,
    ledger_id: null,
    cost_center_id: null,
    status: "open",
    note: null,
  };
}

export function DebtForm({
  open,
  onOpenChange,
  lookups,
  debt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: Lookups;
  debt?: DebtView | null;
}) {
  const form = useForm<DebtInput>({
    resolver: zodResolver(debtSchema) as never,
    defaultValues: blank(),
  });
  const { control, register, handleSubmit, reset, formState } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      debt
        ? {
            creditor_id: debt.creditor_id,
            description: debt.description,
            total_amount: debt.total_amount,
            debt_date: debt.debt_date.slice(0, 10),
            due_date: debt.due_date?.slice(0, 10) ?? null,
            account_id: debt.account_id,
            ledger_id: debt.ledger_id,
            cost_center_id: debt.cost_center_id,
            status: debt.status,
            note: debt.note,
          }
        : blank()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debt?.id]);

  async function onSubmit(values: DebtInput) {
    const result = await saveDebt(debt?.id ?? null, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(debt ? "تم تحديث المديونية" : "تم تسجيل المديونية");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{debt ? "تعديل المديونية" : "مديونية جديدة"}</DialogTitle>
          <DialogDescription>
            سجّل الالتزام كاملًا هنا، ثم سجّل كل دفعة من زر «سجّل دفعة». المتبقي
            يُخصم من المتاح ولا يُحسب مصروفًا حتى يُدفع.
          </DialogDescription>
        </DialogHeader>

        <form
          id="debt-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>المورد / الدائن</Label>
            <Controller
              control={control}
              name="creditor_id"
              render={({ field }) => (
                <Combobox
                  options={lookups.creditors.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  placeholder="اختر المورد"
                />
              )}
            />
            {formState.errors.creditor_id && (
              <p className="text-xs text-destructive">
                {formState.errors.creditor_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-desc">وصف المديونية</Label>
            <Input
              id="debt-desc"
              placeholder="مثال: مقايسة توريد ورق طباعة"
              {...register("description")}
            />
            {formState.errors.description && (
              <p className="text-xs text-destructive">
                {formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="total_amount">الإجمالي</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                min="0"
                className="num"
                {...register("total_amount")}
              />
              {formState.errors.total_amount && (
                <p className="text-xs text-destructive">
                  {formState.errors.total_amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt_date">تاريخ الاتفاق</Label>
              <Input id="debt_date" type="date" {...register("debt_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">الاستحقاق</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-3 text-sm font-medium">التصنيف الموروث للدفعات</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>اسم الحساب</Label>
                <Controller
                  control={control}
                  name="account_id"
                  render={({ field }) => (
                    <Combobox
                      options={lookups.accounts.map((a) => ({
                        value: a.id,
                        label: a.name,
                      }))}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="اختر الحساب"
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>الأستاذ العام</Label>
                <Controller
                  control={control}
                  name="ledger_id"
                  render={({ field }) => (
                    <Combobox
                      options={lookups.ledgers.map((l) => ({
                        value: l.id,
                        label: l.name,
                      }))}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="اختر الأستاذ العام"
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>مركز التكلفة</Label>
                <Controller
                  control={control}
                  name="cost_center_id"
                  render={({ field }) => (
                    <Combobox
                      options={lookups.costCenters.map((c) => ({
                        value: c.id,
                        label: c.name,
                      }))}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="اختر مركز التكلفة"
                    />
                  )}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              كل دفعة تُسجَّل على هذه المديونية ترث هذا التصنيف تلقائيًا، ويمكن
              تعديله على الدفعة نفسها.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-note">ملاحظات</Label>
            <Textarea id="debt-note" rows={2} {...register("note")} />
          </div>
        </form>

        <DialogFooter>
          <Button type="submit" form="debt-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            حفظ
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={formState.isSubmitting}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
