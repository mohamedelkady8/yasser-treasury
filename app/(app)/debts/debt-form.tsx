"use client";

import { useEffect } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
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
import { debtSchema, type DebtInput, type DebtItemInput } from "@/lib/schemas";
import type { DebtItem, DebtView } from "@/lib/database.types";
import type { Lookups } from "@/lib/lookups";
import { egp, today } from "@/lib/format";

function blankItem(): DebtItemInput {
  return {
    name: "",
    unit: null,
    quantity: 1,
    unit_price: "" as unknown as number,
  };
}

function blank(): DebtInput {
  return {
    creditor_id: "",
    description: "",
    debt_date: today(),
    due_date: null,
    account_id: null,
    ledger_id: null,
    cost_center_id: null,
    status: "open",
    note: null,
    items: [blankItem()],
  };
}

function lineTotal(item: DebtItemInput | undefined): number {
  const q = Number(item?.quantity ?? 0);
  const p = Number(item?.unit_price ?? 0);
  return Number.isFinite(q * p) ? q * p : 0;
}

/** الإجمالي محسوب من البنود دائمًا، والقاعدة تعيد حسابه عند الحفظ */
function ItemsTotal({ control }: { control: Control<DebtInput> }) {
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((s, i) => s + lineTotal(i), 0);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/5 px-3 py-2.5">
      <span className="text-sm font-medium">إجمالي المديونية</span>
      <span className="num text-lg font-semibold text-primary">
        {egp(total)}
        <span className="ms-1 text-[0.7em] opacity-60">ج.م</span>
      </span>
    </div>
  );
}

function LineTotal({
  control,
  index,
}: {
  control: Control<DebtInput>;
  index: number;
}) {
  const item = useWatch({ control, name: `items.${index}` });
  return (
    <span className="num text-sm font-medium">{egp(lineTotal(item))}</span>
  );
}

export function DebtForm({
  open,
  onOpenChange,
  lookups,
  debt,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: Lookups;
  debt?: DebtView | null;
  items?: DebtItem[];
}) {
  const form = useForm<DebtInput>({
    resolver: zodResolver(debtSchema) as never,
    defaultValues: blank(),
  });
  const { control, register, handleSubmit, reset, formState } = form;
  const itemFields = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (!open) return;
    reset(
      debt
        ? {
            creditor_id: debt.creditor_id,
            description: debt.description,
            debt_date: debt.debt_date.slice(0, 10),
            due_date: debt.due_date?.slice(0, 10) ?? null,
            account_id: debt.account_id,
            ledger_id: debt.ledger_id,
            cost_center_id: debt.cost_center_id,
            status: debt.status,
            note: debt.note,
            items: items?.length
              ? items.map((i) => ({
                  name: i.name,
                  unit: i.unit,
                  quantity: Number(i.quantity),
                  unit_price: Number(i.unit_price),
                }))
              : // مديونية قديمة بلا بنود: نحوّل إجماليها إلى بند واحد
                [
                  {
                    name: debt.description,
                    unit: null,
                    quantity: 1,
                    unit_price: Number(debt.total_amount),
                  },
                ],
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

  const itemsError = formState.errors.items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{debt ? "تعديل المديونية" : "مديونية جديدة"}</DialogTitle>
          <DialogDescription>
            أضف بنود المقايسة بالكمية وسعر الوحدة، والإجمالي يُحسب تلقائيًا. ثم
            سجّل كل دفعة من زر «سجّل دفعة»، والمتبقي يُخصم من المتاح ولا يُحسب
            مصروفًا حتى يُدفع.
          </DialogDescription>
        </DialogHeader>

        <form
          id="debt-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">بنود المديونية</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => itemFields.append(blankItem())}
              >
                <Plus className="size-3.5" />
                إضافة بند
              </Button>
            </div>

            <div className="hidden gap-2 px-1 pb-1 text-[11px] text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_6rem_8rem_7rem_2rem]">
              <span>البند</span>
              <span>الوحدة</span>
              <span>الكمية</span>
              <span>سعر الوحدة</span>
              <span className="text-end">الإجمالي</span>
              <span />
            </div>

            <div className="space-y-2">
              {itemFields.fields.map((field, index) => {
                const err = formState.errors.items?.[index];
                return (
                  <div
                    key={field.id}
                    className="rounded-lg border bg-background p-2 sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem_8rem_7rem_2rem] sm:items-center">
                      <Input
                        placeholder="اسم البند"
                        aria-label="اسم البند"
                        {...register(`items.${index}.name`)}
                      />
                      <Input
                        placeholder="وحدة"
                        aria-label="الوحدة"
                        {...register(`items.${index}.unit`)}
                      />
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="num"
                        placeholder="الكمية"
                        aria-label="الكمية"
                        {...register(`items.${index}.quantity`)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="num"
                        placeholder="سعر الوحدة"
                        aria-label="سعر الوحدة"
                        {...register(`items.${index}.unit_price`)}
                      />
                      <div className="flex items-center justify-between gap-2 px-1 sm:justify-end">
                        <span className="text-xs text-muted-foreground sm:hidden">
                          إجمالي البند
                        </span>
                        <LineTotal control={control} index={index} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 justify-self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:justify-self-center"
                        aria-label="حذف البند"
                        disabled={itemFields.fields.length === 1}
                        onClick={() => itemFields.remove(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {err && (
                      <p className="mt-1 px-1 text-xs text-destructive">
                        {err.name?.message ??
                          err.quantity?.message ??
                          err.unit_price?.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {itemsError?.message && (
              <p className="mt-2 text-xs text-destructive">{itemsError.message}</p>
            )}

            <div className="mt-3">
              <ItemsTotal control={control} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="grid gap-3 sm:grid-cols-3">
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
