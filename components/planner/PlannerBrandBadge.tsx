import Image from "next/image";

type PlannerBrandBadgeProps = {
  compact?: boolean;
  className?: string;
  variant?: "pill" | "rail";
};

export default function PlannerBrandBadge({
  compact = false,
  className = "",
  variant = "pill",
}: PlannerBrandBadgeProps) {
  if (variant === "rail") {
    const frameClassName = compact
      ? "flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 ring-1 ring-inset ring-teal-700/12"
      : "flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700/10 text-teal-800 ring-1 ring-inset ring-teal-700/12";
    const imageSize = compact ? 22 : 28;
    const titleClassName = compact
      ? "planner-title-sm truncate text-slate-950"
      : "planner-title-md truncate text-slate-950";
    const subtitleClassName = compact
      ? "planner-meta truncate text-slate-500"
      : "planner-copy truncate text-slate-500";

    return (
      <div className={`flex items-center gap-3 ${className}`.trim()}>
        <div className={frameClassName}>
          <Image
            src="/campervan-logo.png"
            alt="Campervansite logo"
            width={708}
            height={624}
            className="h-auto w-auto object-contain"
            style={{ width: imageSize, height: imageSize }}
          />
        </div>

        <div className="min-w-0">
          <p className={titleClassName}>Campervansite</p>
          <p className={subtitleClassName}>Trip planner</p>
        </div>
      </div>
    );
  }

  const containerClassName = compact
    ? "inline-flex max-w-full items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-2.5 py-1.5"
    : "inline-flex max-w-full items-center gap-3 rounded-full border border-teal-100 bg-teal-50/80 px-3 py-2";
  const labelClassName = compact
    ? "planner-eyebrow truncate text-teal-900"
    : "planner-eyebrow truncate text-teal-900";
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
