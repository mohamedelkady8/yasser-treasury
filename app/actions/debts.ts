"use server";

import { revalidatePath } from "next/cache";
import { debtSchema, type DebtInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  for (const p of ["/", "/entries", "/debts", "/creditors", "/review", "/reports"])
    revalidatePath(p);
}

export async function saveDebt(
  id: string | null,
  input: DebtInput
): Promise<ActionResult> {
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { items, ...debt } = parsed.data;

  // دالة واحدة في القاعدة تحفظ المديونية وبنودها معًا وتحسب الإجمالي من البنود
  const supabase = await createClient();
  const { error } = await supabase.rpc("f_save_debt", {
    p_id: id,
    p_debt: debt,
    p_items: items,
  });

  if (error)
    return {
      ok: false,
      error: error.message.startsWith("إجمالي")
        ? error.message
        : "تعذّر حفظ المديونية",
    };

  revalidateAll();
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  // فصل الدفعات أولًا حتى تبقى قيود المصروف كما هي في السجل
  await supabase.from("entries").update({ debt_id: null }).eq("debt_id", id);
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) return { ok: false, error: "تعذّر حذف المديونية" };

  revalidateAll();
  return { ok: true };
}

export async function setDebtStatus(
  id: string,
  status: "open" | "cancelled"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "تعذّر تحديث حالة المديونية" };
  revalidateAll();
  return { ok: true };
}

/** ربط قيد مصروف قائم بمديونية ليُحسب منها دون إعادة إدخال */
export async function linkEntryToDebt(
  entryId: string,
  debtId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({ debt_id: debtId })
    .eq("id", entryId)
    .eq("kind", "expense");
  if (error) return { ok: false, error: "تعذّر ربط القيد بالمديونية" };
  revalidateAll();
  return { ok: true };
}
