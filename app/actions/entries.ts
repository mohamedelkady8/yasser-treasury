"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { entrySchema, type EntryInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true; entryCode?: string }
  | { ok: false; error: string };

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "بيانات غير صحيحة";
}

function dbError(message: string): string {
  if (message.includes("entries_revenue_needs_type")) return "نوع الإيراد مطلوب";
  if (message.includes("entries_revenue_no_custody"))
    return "حركات العهد تُسجَّل في المصروفات فقط";
  if (message.includes("entries_amount")) return "المبلغ يجب أن يكون أكبر من صفر";
  if (message.includes("duplicate key")) return "رقم القيد مستخدم بالفعل";
  return "تعذّر حفظ القيد، تحقّق من البيانات";
}

/** يمسح الحقول التي لا تنتمي لنوع القيد حتى لا تصطدم بقيود القاعدة */
function normalize(input: z.output<typeof entrySchema>) {
  const row = { ...input };
  if (row.kind === "revenue") {
    row.account_id = null;
    row.ledger_id = null;
    row.cost_center_id = null;
    row.debt_id = null;
  } else {
    row.revenue_type_id = null;
    if (row.movement_type === "custody_expense") row.bank_id = null;
  }
  return row;
}

function revalidateAll() {
  for (const p of [
    "/",
    "/entries",
    "/custody",
    "/banks",
    "/debts",
    "/creditors",
    "/review",
    "/reports",
  ])
    revalidatePath(p);
}

export async function createEntry(input: EntryInput): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .insert(normalize(parsed.data))
    .select("entry_code")
    .single();

  if (error) return { ok: false, error: dbError(error.message) };
  revalidateAll();
  return { ok: true, entryCode: data.entry_code };
}

export async function updateEntry(
  id: string,
  input: EntryInput
): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update(normalize(parsed.data))
    .eq("id", id);

  if (error) return { ok: false, error: dbError(error.message) };
  revalidateAll();
  return { ok: true };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) return { ok: false, error: "تعذّر حذف القيد" };
  revalidateAll();
  return { ok: true };
}

export async function setReconStatus(
  id: string,
  status: "pending" | "reconciled"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({ recon_status: status })
    .eq("id", id);
  if (error) return { ok: false, error: "تعذّر تحديث حالة المطابقة" };
  revalidateAll();
  return { ok: true };
}
