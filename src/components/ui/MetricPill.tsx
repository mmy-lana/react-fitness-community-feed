import type { ReactNode } from 'react';

export interface MetricPillProps {
  /** Uppercase caption above the value. */
  label: string;
  /** Formatted measurement, e.g. `10.45`. */
  value: string;
  /** Unit or qualifier rendered next to the value, e.g. `km`. */
  unit?: string;
  /** Leading glyph. */
  icon?: ReactNode;
  /** Renders the value in the accent colour. */
  emphasis?: boolean;
  className?: string;
}

/** One labelled measurement. Used by the stats grid and the weekly summary. */
export function MetricPill({
  label,
  value,
  unit,
  icon,
  emphasis = false,
  className = '',
}: MetricPillProps) {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-tertiary">
        {icon}
        {label}
      </span>
      <span
        className={`text-base font-bold truncate ${emphasis ? 'text-strava-orange' : 'text-ink-primary'}`}
      >
        {value}
        {unit ? <span className="ml-0.5 text-xs font-normal text-ink-tertiary">{unit}</span> : null}
      </span>
    </div>
  );
}
