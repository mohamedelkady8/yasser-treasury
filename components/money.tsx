import { egp } from "@/lib/format";
import { cn } from "@/lib/utils";

/** مبلغ بالجنيه بأرقام مصطفّة، مع تلوين اختياري بحسب الإشارة */
export function Money({
  value,
  sign = false,
  className,
  currency = true,
}: {
  value: number | string | null | undefined;
  sign?: boolean;
  className?: string;
  currency?: boolean;
}) {
  const n = Number(value ?? 0);
  return (
    <span
      className={cn(
        "num",
        sign && (n < -0.005 ? "text-negative" : n > 0.005 ? "text-positive" : ""),
        className
      )}
    >
      {egp(n)}
      {currency && <span className="ms-1 text-[0.85em] opacity-60">ج.م</span>}
    </span>
  );
}
