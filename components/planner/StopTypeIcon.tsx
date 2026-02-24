"use client";

import { StopVisualKind } from "@/types/trip";

type StopTypeIconProps = {
  kind: StopVisualKind;
  className?: string;
  title?: string;
};

const baseClass = "inline-block";

export default function StopTypeIcon({ kind, className = "h-4 w-4", title }: StopTypeIconProps) {
  const classes = `${baseClass} ${className}`;

  if (kind === "stay") {
    return (
      <svg viewBox="0 0 24 24" className={classes} fill="none" aria-hidden={title ? undefined : true}>
        {title ? <title>{title}</title> : null}
        <path d="M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M6 18V10.8c0-.4.3-.8.8-.8h2.5c.3 0 .6-.1.8-.4l1.3-1.8c.3-.4.9-.4 1.2 0l1.3 1.8c.2.3.5.4.8.4h2.5c.5 0 .8.4.8.8V18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "ferry") {
    return (
      <svg viewBox="0 0 24 24" className={classes} fill="none" aria-hidden={title ? undefined : true}>
        {title ? <title>{title}</title> : null}
        <path d="M5 11h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 11l1.5-4h7L17 11" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 16c1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} fill="none" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M12 20s6-5.1 6-10a6 6 0 10-12 0c0 4.9 6 10 6 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
