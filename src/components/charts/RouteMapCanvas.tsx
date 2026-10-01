import { useId } from 'react';
import type { GeoPoint, SportType } from '../../types/fitness';
import { SPORT_COLOR_MAP } from '../../utils/sportMaps';
import { projectCoordinates } from '../../utils/telemetryMath';

export interface RouteMapCanvasProps {
  coordinates: GeoPoint[];
  sportType: SportType;
  className?: string;
  /** Supplied by the card so tapping the map can open the full-screen view. */
  onExpand?: () => void;
}

/** viewBox dimensions the projection is computed against. */
const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 220;

/**
 * GPS track drawn as an inline SVG.
 *
 * Gradient stops use `currentColor` instead of literal hex so the route
 * inherits its sport colour, and the gradient id is derived from `useId()`
 * with invalid characters stripped, so ten cards on one page can never share
 * (and overwrite) each other's gradient.
 */
export function RouteMapCanvas({
  coordinates,
  sportType,
  className = '',
  onExpand,
}: RouteMapCanvasProps) {
  const rawId = useId();
  const gradientId = `route-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;

  if (!coordinates || coordinates.length === 0) {
    return (
      <div
        className={`flex aspect-[480/220] items-center justify-center rounded-lg border border-surface-700/50 bg-surface-900 text-xs text-ink-tertiary ${className}`}
      >
        No GPS track recorded
      </div>
    );
  }

  const { pathD, startPoint, endPoint } = projectCoordinates(coordinates, VIEW_WIDTH, VIEW_HEIGHT, 24);
  const expandable = typeof onExpand === 'function';

  return (
    <button
      type="button"
      onClick={onExpand}
      disabled={!expandable}
      aria-label={expandable ? 'Enlarge GPS route' : 'GPS route preview'}
      data-testid="route-map"
      className={[
        'relative block w-full select-none overflow-hidden rounded-lg border border-surface-700/60 bg-surface-900/90 p-0 text-left',
        SPORT_COLOR_MAP[sportType],
        expandable
          ? 'cursor-pointer transition-colors hover:border-surface-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange'
          : 'cursor-default',
        className,
      ].join(' ')}
    >
      {/* Hidden from assistive tech: the wrapping button already carries the
          control's name, and the shape of a track is not describable in text. */}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className="block h-full w-full min-w-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
            <stop offset="100%" stopColor="currentColor" />
          </linearGradient>
          <pattern id={`${gradientId}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" className="stroke-surface-700/40" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill={`url(#${gradientId}-grid)`} />

        <path
          d={pathD}
          data-testid="route-path"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {startPoint ? (
          <g>
            <circle cx={startPoint.x} cy={startPoint.y} r="6" className="fill-emerald-400/25" />
            <circle cx={startPoint.x} cy={startPoint.y} r="3.5" className="fill-emerald-400 stroke-white" strokeWidth="1.5" />
          </g>
        ) : null}

        {endPoint ? (
          <g>
            <circle cx={endPoint.x} cy={endPoint.y} r="6" className="fill-rose-400/25" />
            <circle cx={endPoint.x} cy={endPoint.y} r="3.5" className="fill-rose-500 stroke-white" strokeWidth="1.5" />
          </g>
        ) : null}
      </svg>

      <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
        <span className="flex items-center gap-1 rounded bg-surface-900/80 px-1.5 py-0.5 text-emerald-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Start
        </span>
        <span className="flex items-center gap-1 rounded bg-surface-900/80 px-1.5 py-0.5 text-rose-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          Finish
        </span>
      </span>

      {expandable ? (
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-surface-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">
          Tap to expand
        </span>
      ) : null}
    </button>
  );
}
