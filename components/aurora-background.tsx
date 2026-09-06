/**
 * خلفية زخرفية ثابتة خلف كل الصفحات: هالات لونية تتحرك ببطء فوق شبكة خفيفة.
 * زخرفية بالكامل — مخفية عن قارئات الشاشة وعن الطباعة، ولا تلتقط أي نقرة.
 */
export function AuroraBackground() {
  return (
    <div
      data-aurora
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* شبكة رقيقة تعطي إحساس العمق تحت الزجاج */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 0%, black 40%, transparent 100%)",
        }}
      />

      <div
        className="absolute -top-40 -start-32 size-[34rem] rounded-full blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, var(--aurora-1), transparent 68%)" }}
      />
      <div
        className="absolute -bottom-48 -end-24 size-[38rem] rounded-full blur-3xl animate-aurora"
        style={{
          background: "radial-gradient(circle, var(--aurora-2), transparent 68%)",
          animationDelay: "-9s",
        }}
      />
      <div
        className="absolute top-1/3 start-1/2 size-[28rem] -translate-x-1/2 rounded-full blur-3xl animate-aurora"
        style={{
          background: "radial-gradient(circle, var(--aurora-3), transparent 70%)",
          animationDelay: "-17s",
        }}
      />
    </div>
  );
}
