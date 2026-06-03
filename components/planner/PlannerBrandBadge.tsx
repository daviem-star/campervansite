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
    const imageSize = compact ? 44 : 56;
    const titleClassName = compact
      ? "planner-title-sm truncate text-app-text"
      : "planner-title-md truncate text-app-text";
    const subtitleClassName = compact
      ? "planner-meta truncate text-app-muted"
      : "planner-copy truncate text-app-muted";

    return (
      <div className={`flex items-center gap-3 ${className}`.trim()}>
        <Image
          src="/campervan-logo.png"
          alt="Campervansite logo"
          width={708}
          height={624}
          className="h-auto w-auto shrink-0 object-contain"
          style={{ width: imageSize, height: imageSize }}
        />

        <div className="min-w-0">
          <p className={titleClassName}>Campervansite</p>
          <p className={subtitleClassName}>Trip planner</p>
        </div>
      </div>
    );
  }

  const containerClassName = compact
    ? "inline-flex max-w-full items-center gap-2 rounded-full border border-brand-primary/12 bg-brand-primary/10 px-2.5 py-1.5"
    : "inline-flex max-w-full items-center gap-3 rounded-full border border-brand-primary/12 bg-brand-primary/10 px-3 py-2";
  const labelClassName = compact
    ? "planner-eyebrow truncate text-brand-primary"
    : "planner-eyebrow truncate text-brand-primary";
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
