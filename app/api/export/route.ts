import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTODY_STATE_LABELS,
  DEBT_STATE_LABELS,
  KIND_LABELS,
  MOVEMENT_LABELS,
  RECON_LABELS,
} from "@/lib/format";
import type {
  BankBalance,
  CashPosition,
  CustodyBalance,
  DebtView,
  EntryView,
  OperationalTotals,
} from "@/lib/database.types";

export const runtime = "nodejs";

const MONEY = "#,##0.00";
const HEADER_FILL = "FF1B6B74";

function sheet(wb: ExcelJS.Workbook, name: string) {
  const ws = wb.addWorksheet(name, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  return ws;
}

function header(ws: ExcelJS.Worksheet, columns: Partial<ExcelJS.Column>[]) {
  ws.columns = columns;
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
}

function totalRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(ws.rowCount);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF4F5" } };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("غير مصرّح", { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get("from") || null;
  const to = params.get("to") || null;

  let entriesQuery = supabase
    .from("v_entries")
    .select("*")
    .order("kind")
    .order("entry_date");
  if (from) entriesQuery = entriesQuery.gte("entry_date", from);
  if (to) entriesQuery = entriesQuery.lte("entry_date", to);

  const [entriesRes, banksRes, custodyRes, debtsRes, cashRes, totalsRes, settingsRes] =
    await Promise.all([
      entriesQuery.limit(20000),
      supabase.from("v_bank_balances").select("*").order("sort_order"),
      supabase.from("v_custody_balances").select("*").order("name"),
      supabase.from("v_debt_balances").select("*").order("debt_date"),
      supabase.from("v_cash_position").select("*").single(),
      supabase.rpc("f_operational_totals", { p_from: from, p_to: to }),
      supabase.from("settings").select("company_name").single(),
    ]);

  const entries = (entriesRes.data ?? []) as EntryView[];
  const banks = (banksRes.data ?? []) as BankBalance[];
  const custody = (custodyRes.data ?? []) as CustodyBalance[];
  const debts = (debtsRes.data ?? []) as DebtView[];
  const cash = (cashRes.data ?? {}) as CashPosition;
  const totals = ((totalsRes.data as OperationalTotals[] | null)?.[0] ??
    {}) as OperationalTotals;
  const company = settingsRes.data?.company_name ?? "الشركة";

  const wb = new ExcelJS.Workbook();
  wb.creator = company;
  wb.created = new Date();

  // ---- الملخص
  const summary = sheet(wb, "الملخص");
  header(summary, [
    { header: "البند", key: "label", width: 38 },
    { header: "القيمة", key: "value", width: 20, style: { numFmt: MONEY } },
    { header: "ملاحظة", key: "note", width: 46 },
  ]);
  const period =
    from || to ? `من ${from ?? "البداية"} إلى ${to ?? "النهاية"}` : "كل الفترات";
  for (const row of [
    { label: "الفترة", value: period, note: "" },
    { label: "الإيراد التشغيلي", value: Number(totals.revenue ?? 0), note: "يستثني التحويلات الداخلية" },
    {
      label: "منها أرصدة افتتاحية",
      value: Number(totals.opening_balances ?? 0),
      note: "نقطة بداية لا إيراد حقيقي",
    },
    {
      label: "الإيراد بدون الأرصدة الافتتاحية",
      value: Number(totals.revenue_excl_opening ?? 0),
      note: "",
    },
    {
      label: "المصروف التشغيلي",
      value: Number(totals.expense ?? 0),
      note: "يشمل المصروف من العهد ويستثني التحويلات وصرف العهد",
    },
    { label: "صافي التشغيل", value: Number(totals.net ?? 0), note: "" },
    { label: "التحويلات الداخلية", value: Number(totals.internal_transfers ?? 0), note: "لا تُحسب إيرادًا أو مصروفًا" },
    { label: "", value: "", note: "" },
    { label: "أرصدة البنوك والخزائن", value: Number(cash.bank_total ?? 0), note: "" },
    {
      label: "العهد القائمة عند الموظفين",
      value: Number(cash.custody_total ?? 0),
      note: "مال الشركة في يد موظف",
    },
    { label: "إجمالي النقدية", value: Number(cash.total_cash ?? 0), note: "" },
    {
      label: "المديونيات المتبقية للموردين",
      value: Number(cash.debts_outstanding ?? 0),
      note: "لم تخرج من الخزنة بعد",
    },
    {
      label: "المتاح بعد سداد كل المديونيات",
      value: Number(cash.available_after_debts ?? 0),
      note: "الرقم الذي يُقال لصاحب الشركة",
    },
  ])
    summary.addRow(row);
  totalRow(summary);
  summary.getRow(2).font = { bold: true };

  // ---- القيود
  const ws = sheet(wb, "القيود");
  header(ws, [
    { header: "رقم القيد", key: "code", width: 12 },
    { header: "النوع", key: "kind", width: 9 },
    { header: "التاريخ", key: "date", width: 12 },
    { header: "المبلغ", key: "amount", width: 15, style: { numFmt: MONEY } },
    { header: "البيان", key: "description", width: 40 },
    { header: "نوع الإيراد", key: "revenue_type", width: 22 },
    { header: "اسم الحساب", key: "account", width: 22 },
    { header: "الأستاذ العام", key: "ledger", width: 24 },
    { header: "مركز التكلفة", key: "cost_center", width: 26 },
    { header: "البنك / الخزينة", key: "bank", width: 22 },
    { header: "نوع الحركة", key: "movement", width: 16 },
    { header: "المطابقة", key: "recon", width: 10 },
    { header: "المديونية", key: "debt", width: 30 },
    { header: "ملاحظات", key: "note", width: 24 },
  ]);
  for (const e of entries)
    ws.addRow({
      code: e.entry_code,
      kind: KIND_LABELS[e.kind],
      date: e.entry_date,
      amount: Number(e.amount),
      description: e.description ?? "",
      revenue_type: e.revenue_type_name ?? "",
      account: e.account_name ?? "",
      ledger: e.ledger_name ?? "",
      cost_center: e.cost_center_name ?? "",
      bank: e.bank_name ?? "",
      movement: MOVEMENT_LABELS[e.movement_type],
      recon: RECON_LABELS[e.recon_status],
      debt: e.creditor_name ? `${e.creditor_name} — ${e.debt_description}` : "",
      note: e.note ?? "",
    });
  ws.autoFilter = { from: "A1", to: { row: 1, column: 14 } };

  // ---- أرصدة البنوك
  const bankSheet = sheet(wb, "أرصدة البنوك");
  header(bankSheet, [
    { header: "البنك / الخزينة", key: "name", width: 28 },
    { header: "الرصيد الافتتاحي", key: "opening", width: 18, style: { numFmt: MONEY } },
    { header: "الإيراد الداخل", key: "in", width: 18, style: { numFmt: MONEY } },
    { header: "المصروف الخارج", key: "out", width: 18, style: { numFmt: MONEY } },
    { header: "مرتجع العهد", key: "back", width: 16, style: { numFmt: MONEY } },
    { header: "صافي الحركة", key: "net", width: 18, style: { numFmt: MONEY } },
    { header: "الرصيد الحالي", key: "balance", width: 18, style: { numFmt: MONEY } },
    { header: "عدد القيود", key: "count", width: 12 },
  ]);
  for (const b of banks)
    bankSheet.addRow({
      name: b.name + (b.is_usd ? " (دولار)" : ""),
      opening: Number(b.opening_balance),
      in: Number(b.revenue_in),
      out: Number(b.expense_out),
      back: Number(b.custody_back),
      net: Number(b.net_movement),
      balance: Number(b.balance),
      count: Number(b.entry_count),
    });
  bankSheet.addRow({
    name: "الإجمالي",
    opening: banks.reduce((s, b) => s + Number(b.opening_balance), 0),
    net: banks.reduce((s, b) => s + Number(b.net_movement), 0),
    balance: Number(cash.bank_total ?? 0),
  });
  totalRow(bankSheet);

  // ---- العهد
  const custodySheet = sheet(wb, "العهد");
  header(custodySheet, [
    { header: "العهدة", key: "name", width: 28 },
    { header: "صاحب العهدة", key: "holder", width: 20 },
    { header: "الافتتاحي", key: "opening", width: 16, style: { numFmt: MONEY } },
    { header: "صُرف", key: "out", width: 16, style: { numFmt: MONEY } },
    { header: "أُنفق", key: "spent", width: 16, style: { numFmt: MONEY } },
    { header: "رُدَّ", key: "returned", width: 16, style: { numFmt: MONEY } },
    { header: "الرصيد القائم", key: "balance", width: 18, style: { numFmt: MONEY } },
    { header: "الحالة", key: "state", width: 12 },
  ]);
  for (const c of custody)
    custodySheet.addRow({
      name: c.name,
      holder: c.custody_holder ?? "",
      opening: Number(c.custody_opening),
      out: Number(c.paid_out),
      spent: Number(c.spent),
      returned: Number(c.returned),
      balance: Number(c.balance),
      state: CUSTODY_STATE_LABELS[c.state],
    });

  // ---- المديونيات
  const debtSheet = sheet(wb, "المديونيات");
  header(debtSheet, [
    { header: "المورد / الدائن", key: "creditor", width: 24 },
    { header: "المديونية", key: "description", width: 36 },
    { header: "الإجمالي", key: "total", width: 16, style: { numFmt: MONEY } },
    { header: "المدفوع", key: "paid", width: 16, style: { numFmt: MONEY } },
    { header: "المتبقي", key: "remaining", width: 16, style: { numFmt: MONEY } },
    { header: "نسبة السداد", key: "pct", width: 12 },
    { header: "تاريخ الاتفاق", key: "date", width: 14 },
    { header: "الاستحقاق", key: "due", width: 14 },
    { header: "الحالة", key: "state", width: 12 },
    { header: "مركز التكلفة", key: "cost_center", width: 24 },
  ]);
  for (const d of debts)
    debtSheet.addRow({
      creditor: d.creditor_name,
      description: d.description,
      total: Number(d.total_amount),
      paid: Number(d.paid_amount),
      remaining: Number(d.remaining),
      pct: `${Number(d.paid_pct)}%`,
      date: d.debt_date,
      due: d.due_date ?? "",
      state: DEBT_STATE_LABELS[d.state],
      cost_center: d.cost_center_name ?? "",
    });
  if (debts.length) {
    debtSheet.addRow({
      creditor: "الإجمالي",
      total: debts.reduce((s, d) => s + Number(d.total_amount), 0),
      paid: debts.reduce((s, d) => s + Number(d.paid_amount), 0),
      remaining: Number(cash.debts_outstanding ?? 0),
    });
    totalRow(debtSheet);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finance-report-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
