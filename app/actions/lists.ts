"use server";

import { revalidatePath } from "next/cache";
import {
  bankSchema,
  costCenterSchema,
  creditorSchema,
  nameSchema,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SimpleTable = "accounts" | "ledgers" | "revenue_types";

function revalidateAll() {
  for (const p of [
    "/",
    "/entries",
    "/custody",
    "/banks",
    "/lists",
    "/debts",
    "/creditors",
    "/review",
    "/reports",
  ])
    revalidatePath(p);
}

function fail(message: string): ActionResult {
  if (message.includes("duplicate key")) return { ok: false, error: "الاسم موجود بالفعل" };
  if (message.includes("violates foreign key"))
    return {
      ok: false,
      error: "لا يمكن الحذف لأن هناك قيودًا مرتبطة — أوقف التفعيل بدلًا من الحذف",
    };
  return { ok: false, error: "تعذّر تنفيذ العملية" };
}

export async function createSimple(
  table: SimpleTable,
  name: string
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse({ name });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from(table).insert({ name: parsed.data.name });
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function renameSimple(
  table: SimpleTable,
  id: string,
  name: string
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse({ name });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ name: parsed.data.name })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function toggleActive(
  table: SimpleTable | "banks" | "cost_centers" | "creditors",
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function removeRow(
  table: SimpleTable | "banks" | "cost_centers" | "creditors",
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function saveBank(
  id: string | null,
  input: { name: string; opening_balance: number | string; is_usd: boolean; is_active: boolean }
): Promise<ActionResult> {
  const parsed = bankSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("banks").update(parsed.data).eq("id", id)
    : await supabase.from("banks").insert(parsed.data);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function saveCostCenter(
  id: string | null,
  input: {
    name: string;
    custody_opening: number | string;
    custody_holder: string | null;
    is_active: boolean;
  }
): Promise<ActionResult> {
  const parsed = costCenterSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("cost_centers").update(parsed.data).eq("id", id)
    : await supabase.from("cost_centers").insert(parsed.data);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function saveCreditor(
  id: string | null,
  input: { name: string; phone: string | null; note: string | null }
): Promise<ActionResult> {
  const parsed = creditorSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("creditors").update(parsed.data).eq("id", id)
    : await supabase.from("creditors").insert(parsed.data);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}

export async function saveSettings(input: {
  usd_rate: number | string;
  company_name: string;
}): Promise<ActionResult> {
  const rate = Number(input.usd_rate);
  const name = input.company_name.trim();
  if (!Number.isFinite(rate) || rate <= 0)
    return { ok: false, error: "سعر الصرف غير صحيح" };
  if (!name) return { ok: false, error: "اسم الشركة مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ usd_rate: rate, company_name: name, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return fail(error.message);
  revalidateAll();
  return { ok: true };
}
