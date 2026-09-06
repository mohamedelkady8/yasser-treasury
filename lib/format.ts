const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function egp(value: number | string | null | undefined): string {
  return money.format(Number(value ?? 0));
}

export function egpShort(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return Math.abs(n) >= 10_000 ? compact.format(n) : money.format(n);
}

/** الدولار النقدي المكافئ لرصيد مسجَّل بالجنيه، على سعر الصرف المحفوظ */
export function toUsd(
  value: number | string | null | undefined,
  rate: number | string | null | undefined
): number {
  const r = Number(rate ?? 0);
  return r > 0 ? Number(value ?? 0) / r : 0;
}

export function usd(value: number | string | null | undefined): string {
  return `$${money.format(Number(value ?? 0))}`;
}

export function num(value: number | string | null | undefined): string {
  return plain.format(Number(value ?? 0));
}

export function pct(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/** التاريخ بصيغة قصيرة بأرقام لاتينية: 09/08/2026 */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${d} ${AR_MONTHS[m - 1]} ${y}`;
}

export function fmtMonth(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m] = value.slice(0, 10).split("-").map(Number);
  return `${AR_MONTHS[m - 1]} ${y}`;
}

export function today(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function monthStart(d = today()): string {
  return `${d.slice(0, 7)}-01`;
}

export const MOVEMENT_LABELS = {
  operational: "تشغيلي",
  internal_transfer: "تحويل داخلي",
  custody_out: "صرف عهدة",
  custody_expense: "مصروف من العهدة",
  custody_return: "مرتجع عهدة",
} as const;

export const RECON_LABELS = {
  pending: "لم تتم",
  reconciled: "تمت",
} as const;

export const CUSTODY_STATE_LABELS = {
  settled: "مُصفّاة",
  outstanding: "قائمة",
  negative: "سالبة",
} as const;

export const DEBT_STATE_LABELS = {
  open: "قائمة",
  overdue: "متأخرة",
  settled: "مسددة",
  cancelled: "ملغاة",
} as const;

export const KIND_LABELS = {
  revenue: "إيراد",
  expense: "مصروف",
} as const;
