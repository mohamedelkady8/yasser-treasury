"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Save, SaveAll } from "lucide-react";
import { toast } from "sonner";
import { createEntry, updateEntry } from "@/app/actions/entries";
import { Combobox, type Option } from "@/components/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { entrySchema, type EntryInput } from "@/lib/schemas";
import type { Lookups } from "@/lib/lookups";
import type { EntryView } from "@/lib/database.types";
import { MOVEMENT_LABELS, egp, today } from "@/lib/format";
import { cn } from "@/lib/utils";

const REVENUE_MOVEMENTS = ["operational", "internal_transfer"] as const;
const EXPENSE_MOVEMENTS = [
  "operational",
  "internal_transfer",
  "custody_out",
  "custody_expense",
  "custody_return",
] as const;

function blank(preset?: Partial<EntryInput>): EntryInput {
  return {
    kind: "expense",
    amount: "" as unknown as number,
    description: "",
    entry_date: today(),
    movement_type: "operational",
    recon_status: "pending",
    bank_id: null,
    revenue_type_id: null,
    account_id: null,
    ledger_id: null,
    cost_center_id: null,
    debt_id: null,
    note: null,
    document_url: null,
    ...preset,
  };
}

function fromEntry(entry: EntryView): EntryInput {
  return {
    kind: entry.kind,
    amount: entry.amount,
    description: entry.description ?? "",
    entry_date: entry.entry_date.slice(0, 10),
    movement_type: entry.movement_type,
    recon_status: entry.recon_status,
    bank_id: entry.bank_id,
    revenue_type_id: entry.revenue_type_id,
    account_id: entry.account_id,
    ledger_id: entry.ledger_id,
    cost_center_id: entry.cost_center_id,
    debt_id: entry.debt_id,
    note: entry.note,
    document_url: entry.document_url,
  };
}

function toOptions(rows: { id: string; name: string }[]): Option[] {
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export function EntryForm({
  open,
  onOpenChange,
  lookups,
  entry,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: Lookups;
  entry?: EntryView | null;
  preset?: Partial<EntryInput>;
}) {
  const editing = Boolean(entry);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const form = useForm<EntryInput>({
    resolver: zodResolver(entrySchema) as never,
    defaultValues: entry ? fromEntry(entry) : blank(preset),
  });
  const { control, register, handleSubmit, setValue, reset, formState } = form;

  useEffect(() => {
    if (open) reset(entry ? fromEntry(entry) : blank(preset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const kind = useWatch({ control, name: "kind" });
  const movement = useWatch({ control, name: "movement_type" });
  const debtId = useWatch({ control, name: "debt_id" });
  const costCenterId = useWatch({ control, name: "cost_center_id" });
  const accountId = useWatch({ control, name: "account_id" });
  const amount = useWatch({ control, name: "amount" });

  const custodyMovement =
    movement === "custody_out" ||
    movement === "custody_expense" ||
    movement === "custody_return";

  const bankOptions = useMemo(
    () =>
      lookups.banks.map((b) => ({
        value: b.id,
        label: b.name,
        hint: b.is_usd ? "دولار" : undefined,
      })),
    [lookups.banks]
  );

  const costCenterOptions = useMemo(
    () =>
      (custodyMovement
        ? lookups.costCenters.filter((c) => c.is_custody)
        : lookups.costCenters
      ).map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.is_custody ? "عهدة" : undefined,
      })),
    [lookups.costCenters, custodyMovement]
  );

  const debtOptions = useMemo(
    () =>
      lookups.openDebts.map((d) => ({
        value: d.id,
        label: `${d.creditor_name} — ${d.description}`,
        hint: `متبقٍ ${egp(d.remaining)}`,
      })),
    [lookups.openDebts]
  );

  const selectedDebt = lookups.openDebts.find((d) => d.id === debtId);
  const selectedCostCenter = lookups.costCenters.find((c) => c.id === costCenterId);

  // تحويل نوع القيد إلى إيراد يمنع أنواع حركة العهد
  useEffect(() => {
    if (kind === "revenue" && custodyMovement) setValue("movement_type", "operational");
  }, [kind, custodyMovement, setValue]);

  // مصروف من العهدة لا بنك له
  useEffect(() => {
    if (movement === "custody_expense") setValue("bank_id", null);
  }, [movement, setValue]);

  // ربط دفعة بمديونية يورّث تصنيفها
  function pickDebt(value: string | null) {
    setValue("debt_id", value);
    const debt = lookups.openDebts.find((d) => d.id === value);
    if (!debt) return;
    setValue("account_id", debt.account_id ?? null);
    setValue("ledger_id", debt.ledger_id ?? null);
    setValue("cost_center_id", debt.cost_center_id ?? null);
  }

  const softWarnings: string[] = [];
  if (kind === "expense" && !costCenterId && !custodyMovement)
    softWarnings.push("مركز التكلفة فارغ — القيد سيظهر في صفحة المراجعة");
  if (kind === "expense" && !accountId)
    softWarnings.push("اسم الحساب فارغ");
  if (selectedDebt && Number(amount) > Number(selectedDebt.remaining) + 0.005)
    softWarnings.push(
      `المبلغ أكبر من متبقي المديونية (${egp(selectedDebt.remaining)})`
    );
  if (selectedCostCenter && !selectedCostCenter.is_custody && custodyMovement)
    softWarnings.push("مركز التكلفة المختار لا يبدأ اسمه بكلمة «عهد»");

  async function save(values: EntryInput, again: boolean) {
    setBusy(true);
    const result = entry
      ? await updateEntry(entry.id, values)
      : await createEntry(values);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      entry
        ? "تم تحديث القيد"
        : `تم حفظ القيد${result.entryCode ? ` ${result.entryCode}` : ""}`
    );

    if (again) {
      const keep = {
        kind: values.kind,
        entry_date: values.entry_date,
        movement_type: values.movement_type,
        bank_id: values.bank_id,
        account_id: values.account_id,
        ledger_id: values.ledger_id,
        cost_center_id: values.cost_center_id,
      };
      reset(blank(keep));
    } else {
      onOpenChange(false);
    }
    startTransition(() => {});
  }

  const working = busy || pending;
  const movements = kind === "revenue" ? REVENUE_MOVEMENTS : EXPENSE_MOVEMENTS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>
            {editing ? `تعديل القيد ${entry?.entry_code}` : "قيد جديد"}
          </SheetTitle>
          <SheetDescription>
            {editing
              ? "التعديل يُسجَّل في سجل التغييرات"
              : "التاريخ افتراضيًا اليوم، والقوائم تقبل البحث بالكتابة"}
          </SheetDescription>
        </SheetHeader>

        <form
          id="entry-form"
          onSubmit={handleSubmit((v) => save(v, false))}
          className="scroll-slim flex-1 space-y-4 overflow-y-auto px-5 py-4"
        >
          {!editing && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              {(["revenue", "expense"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setValue("kind", k)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    kind === k
                      ? k === "revenue"
                        ? "bg-positive text-white shadow-sm"
                        : "bg-negative text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {k === "revenue" ? "إيراد" : "مصروف"}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">المبلغ</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="num"
                {...register("amount")}
              />
              <FieldError message={formState.errors.amount?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_date">التاريخ</Label>
              <Input id="entry_date" type="date" {...register("entry_date")} />
              <FieldError message={formState.errors.entry_date?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">البيان</Label>
            <Input
              id="description"
              placeholder="مثال: دفعة توريد ورق"
              {...register("description")}
            />
            <FieldError message={formState.errors.description?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement_type">نوع الحركة</Label>
            <Controller
              control={control}
              name="movement_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="movement_type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {movements.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MOVEMENT_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {movement === "internal_transfer"
                ? "التحويل الداخلي لا يُحسب في الإيراد أو المصروف التشغيلي"
                : movement === "custody_out"
                  ? "المال يخرج من البنك إلى يد الموظف ويظهر كعهدة قائمة"
                  : movement === "custody_expense"
                    ? "المال يخرج من يد الموظف فلا يُربط ببنك، ويُحسب مصروفًا فعليًا"
                    : movement === "custody_return"
                      ? "المتبقي يعود من الموظف إلى البنك وتُصفّى العهدة"
                      : "الحركة التشغيلية العادية"}
            </p>
          </div>

          {kind === "revenue" ? (
            <FieldRow label="نوع الإيراد" error={formState.errors.revenue_type_id?.message}>
              <Controller
                control={control}
                name="revenue_type_id"
                render={({ field }) => (
                  <Combobox
                    options={toOptions(lookups.revenueTypes)}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="اختر نوع الإيراد"
                  />
                )}
              />
            </FieldRow>
          ) : (
            <>
              <FieldRow
                label="مديونية مرتبطة"
                hint="اختر مديونية لتسجيل هذا القيد دفعةً منها"
              >
                <Combobox
                  options={debtOptions}
                  value={debtId ?? null}
                  onChange={pickDebt}
                  placeholder="لا يوجد ربط"
                  searchPlaceholder="ابحث بالمورد أو الوصف…"
                />
              </FieldRow>

              <FieldRow label="اسم الحساب" error={formState.errors.account_id?.message}>
                <Controller
                  control={control}
                  name="account_id"
                  render={({ field }) => (
                    <Combobox
                      options={toOptions(lookups.accounts)}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="اختر الحساب"
                    />
                  )}
                />
              </FieldRow>

              <FieldRow label="الأستاذ العام" error={formState.errors.ledger_id?.message}>
                <Controller
                  control={control}
                  name="ledger_id"
                  render={({ field }) => (
                    <Combobox
                      options={toOptions(lookups.ledgers)}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="اختر الأستاذ العام"
                    />
                  )}
                />
              </FieldRow>

              <FieldRow
                label={custodyMovement ? "مركز العهدة" : "مركز التكلفة"}
                error={formState.errors.cost_center_id?.message}
                hint={
                  custodyMovement
                    ? "معروضة مراكز العهد فقط"
                    : undefined
                }
              >
                <Controller
                  control={control}
                  name="cost_center_id"
                  render={({ field }) => (
                    <Combobox
                      options={costCenterOptions}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="اختر مركز التكلفة"
                    />
                  )}
                />
              </FieldRow>
            </>
          )}

          {movement !== "custody_expense" && (
            <FieldRow label="البنك / الخزينة" error={formState.errors.bank_id?.message}>
              <Controller
                control={control}
                name="bank_id"
                render={({ field }) => (
                  <Combobox
                    options={bankOptions}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="اختر البنك أو الخزينة"
                  />
                )}
              />
            </FieldRow>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recon_status">المطابقة البنكية</Label>
              <Controller
                control={control}
                name="recon_status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="recon_status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">لم تتم</SelectItem>
                      <SelectItem value="reconciled">تمت</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_url">رابط المستند</Label>
              <Input
                id="document_url"
                dir="ltr"
                placeholder="https://…"
                {...register("document_url")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">ملاحظات</Label>
            <Textarea id="note" rows={2} {...register("note")} />
          </div>

          {softWarnings.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="size-4" />
                تنبيهات لا تمنع الحفظ
              </p>
              <ul className="mt-1.5 space-y-1 ps-6 text-xs text-muted-foreground">
                {softWarnings.map((w) => (
                  <li key={w} className="list-disc">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <SheetFooter className="flex-row gap-2 border-t px-5 py-4">
          <Button type="submit" form="entry-form" disabled={working}>
            {working ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {editing ? "حفظ التعديل" : "حفظ"}
          </Button>
          {!editing && (
            <Button
              type="button"
              variant="secondary"
              disabled={working}
              onClick={handleSubmit((v) => save(v, true))}
            >
              <SaveAll className="size-4" />
              حفظ وإضافة آخر
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={working}
          >
            إلغاء
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}
