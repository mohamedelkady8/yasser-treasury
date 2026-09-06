import { z } from "zod";

const id = z.string().uuid().nullable();
const optText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .transform((v) => v || null);

export const entrySchema = z
  .object({
    kind: z.enum(["revenue", "expense"]),
    amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    description: z.string().trim().min(1, "البيان مطلوب").max(500),
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صحيح"),
    movement_type: z.enum([
      "operational",
      "internal_transfer",
      "custody_out",
      "custody_expense",
      "custody_return",
    ]),
    recon_status: z.enum(["pending", "reconciled"]),
    bank_id: id,
    revenue_type_id: id,
    account_id: id,
    ledger_id: id,
    cost_center_id: id,
    debt_id: id,
    note: optText,
    document_url: optText,
  })
  .superRefine((v, ctx) => {
    const fail = (message: string, path: keyof typeof v) =>
      ctx.addIssue({ code: "custom", message, path: [path] });

    if (v.kind === "revenue") {
      if (v.movement_type !== "operational" && v.movement_type !== "internal_transfer")
        fail("حركات العهد تُسجَّل في المصروفات فقط", "movement_type");
      if (v.movement_type === "operational" && !v.revenue_type_id)
        fail("نوع الإيراد مطلوب", "revenue_type_id");
      if (!v.bank_id) fail("البنك أو الخزينة مطلوب", "bank_id");
      return;
    }

    if (v.movement_type === "custody_expense") {
      if (v.bank_id)
        fail("مصروف من العهدة لا يُربط ببنك لأن المال خرج من يد الموظف", "bank_id");
      if (!v.cost_center_id) fail("مركز العهدة مطلوب", "cost_center_id");
    } else if (!v.bank_id) {
      fail("البنك أو الخزينة مطلوب", "bank_id");
    }

    if (
      (v.movement_type === "custody_out" || v.movement_type === "custody_return") &&
      !v.cost_center_id
    )
      fail("مركز العهدة مطلوب لحركات العهد", "cost_center_id");
  });

export type EntryInput = z.input<typeof entrySchema>;
export type EntryValues = z.output<typeof entrySchema>;

/** بند واحد في مقايسة المورد: الكمية × سعر الوحدة = إجمالي البند */
export const debtItemSchema = z.object({
  name: z.string().trim().min(1, "اسم البند مطلوب").max(300),
  unit: optText,
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unit_price: z.coerce.number().min(0, "سعر الوحدة لا يصح أن يكون سالبًا"),
});

export type DebtItemInput = z.input<typeof debtItemSchema>;

export const debtSchema = z
  .object({
    creditor_id: z.string().uuid("المورد مطلوب"),
    description: z.string().trim().min(1, "وصف المديونية مطلوب").max(500),
    debt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صحيح"),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الاستحقاق غير صحيح")
      .nullable()
      .transform((v) => v || null),
    account_id: id,
    ledger_id: id,
    cost_center_id: id,
    status: z.enum(["open", "cancelled"]),
    note: optText,
    // الإجمالي لا يُكتب يدويًا: يُحسب من البنود هنا وفي القاعدة
    items: z.array(debtItemSchema).min(1, "أضف بندًا واحدًا على الأقل"),
  })
  .superRefine((v, ctx) => {
    const total = v.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    if (total <= 0)
      ctx.addIssue({
        code: "custom",
        message: "إجمالي البنود يجب أن يكون أكبر من صفر",
        path: ["items"],
      });
  });

export type DebtInput = z.input<typeof debtSchema>;
export type DebtValues = z.output<typeof debtSchema>;

export const nameSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(200),
});

export const bankSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(200),
  opening_balance: z.coerce.number(),
  is_usd: z.boolean(),
  is_active: z.boolean(),
});

export const costCenterSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(200),
  custody_opening: z.coerce.number(),
  custody_holder: optText,
  is_active: z.boolean(),
});

export const creditorSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(200),
  phone: optText,
  note: optText,
});
