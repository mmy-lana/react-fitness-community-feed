import { useId } from 'react';
import type { ElevationPoint, SportType } from '../../types/fitness';
import { SPORT_COLOR_MAP } from '../../utils/sportMaps';

export interface ElevationChartProps {
  profile: ElevationPoint[];
  sportType?: SportType;
  className?: string;
}

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 100;
const PADDING = 8;

/**
 * Elevation against distance.
 *
 * The SVG holds geometry only: labels are HTML positioned around it, because
 * text inside an SVG that scales down to a 360px phone becomes unreadable.
 */
export function ElevationChart({ profile, sportType = 'run', className = '' }: ElevationChartProps) {
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9-_]/g, '');
  const fillGradientId = `ele-grad-${cleanId}`;

  if (!profile || profile.length < 2) return null;

  let minElevation = profile[0].elevationMeters;
  let maxElevation = profile[0].elevationMeters;

  for (let i = 1; i < profile.length; i++) {
    const elevation = profile[i].elevationMeters;
    if (elevation < minElevation) minElevation = elevation;
    if (elevation > maxElevation) maxElevation = elevation;
  }

  const maxDistance = profile[profile.length - 1].distanceMeters || 1;
  // A flat route still needs a positive range or the path collapses.
  const elevationRange = maxElevation - minElevation || 10;
  const chartWidth = VIEW_WIDTH - PADDING * 2;
  const chartHeight = VIEW_HEIGHT - PADDING * 2;

  const points = profile.map((point) => {
    const x = PADDING + (point.distanceMeters / maxDistance) * chartWidth;
    const y = VIEW_HEIGHT - PADDING - ((point.elevationMeters - minElevation) / elevationRange) * chartHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const strokeSegments: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = Number(((current.x + next.x) / 2).toFixed(1));
    strokeSegments.push(
      `C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
    );
  }

  const strokePath = strokeSegments.join(' ');
  const baselineY = VIEW_HEIGHT - PADDING;
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const fillPath = `${strokePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  return (
    <figure
      data-testid="elevation-chart"
      className={`m-0 w-full rounded-md border border-surface-700/40 bg-surface-900/60 p-2 ${className}`}
    >
      <figcaption className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] text-ink-tertiary">
        <span>Min {minElevation} m</span>
        <span className="truncate uppercase tracking-wider">Elevation profile</span>
        <span>Max {maxElevation} m</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        height="64"
        preserveAspectRatio="none"
        className={`block w-full min-w-0 ${SPORT_COLOR_MAP[sportType]}`}
        role="img"
        aria-label={`Elevation profile from ${minElevation} to ${maxElevation} meters over ${Math.round(maxDistance)} meters`}
      >
        <defs>
          <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={fillPath} fill={`url(#${fillGradientId})`} />
        <path
          d={strokePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-ink-tertiary">
        <span>0 km</span>
        <span>{(maxDistance / 1000).toFixed(2)} km</span>
      </div>
    </figure>
  );
}
