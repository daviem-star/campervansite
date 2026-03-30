import Image from "next/image";

type PlannerBrandBadgeProps = {
  compact?: boolean;
  className?: string;
};

export default function PlannerBrandBadge({
  compact = false,
  className = "",
}: PlannerBrandBadgeProps) {
  const containerClassName = compact
    ? "inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-2.5 py-1.5"
    : "inline-flex max-w-full items-center gap-3 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-2";
  const labelClassName = compact
    ? "truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900 sm:text-[11px]"
    : "truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-900";
  const imageSize = compact ? 28 : 36;

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      <Image
        src="/campervan-logo.png"
        alt="Campervan Trip Planner logo"
        width={708}
        height={624}
        className="h-auto w-auto object-contain"
        style={{ width: imageSize, height: imageSize }}
      />
      <span className={labelClassName}>Campervan Trip Planner</span>
    </div>
  );
}
