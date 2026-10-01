import type { SportType } from '../types/fitness';

/** Pace or speed readout, already split into value and unit for layout. */
export interface PaceOrSpeed {
  value: string;
  unit: string;
}

/**
 * Distance readout. Swimming stays in meters because club swimmers think in
 * pool lengths; every other sport reads better in kilometers.
 */
export function formatDistance(meters: number, sport: SportType): string {
  if (!Number.isFinite(meters) || meters <= 0) return sport === 'swim' ? '0 m' : '0.00 km';
  if (sport === 'swim') {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Elapsed time as `h:mm` under an hour and `m:ss` below an hour. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Speed for rides (km/h), lap pace for swims (/100m), pace for runs and hikes
 * (/km). Distance-less sports degrade gracefully instead of dividing by zero.
 */
export function calculatePaceOrSpeed(
  durationSeconds: number,
  distanceMeters: number,
  sport: SportType
): PaceOrSpeed {
  // Workouts have no distance, so they never carry a pace — only their status.
  if (sport === 'workout') {
    return durationSeconds > 0
      ? { value: 'Active', unit: 'status' }
      : { value: '--', unit: 'pace' };
  }

  if (durationSeconds <= 0 || distanceMeters <= 0) {
    if (sport === 'ride') return { value: '0.0', unit: 'km/h' };
    if (sport === 'swim') return { value: '0:00', unit: '/100m' };
    return { value: '0:00', unit: '/km' };
  }

  if (sport === 'ride') {
    const kmh = (distanceMeters / 1000) / (durationSeconds / 3600);
    return { value: kmh.toFixed(1), unit: 'km/h' };
  }

  if (sport === 'swim') {
    const hundreds = distanceMeters / 100;
    const paceSeconds = Math.round(durationSeconds / hundreds);
    const mins = Math.floor(paceSeconds / 60);
    const secs = paceSeconds % 60;
    return { value: `${mins}:${secs.toString().padStart(2, '0')}`, unit: '/100m' };
  }

  const km = distanceMeters / 1000;
  const roundedPaceTotalSeconds = Math.round(durationSeconds / km);
  const paceMinutes = Math.floor(roundedPaceTotalSeconds / 60);
  const paceSeconds = roundedPaceTotalSeconds % 60;
  return {
    value: `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`,
    unit: '/km',
  };
}

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Two-letter monogram for avatars: "Alex Reynolds" becomes "AR". */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
/** "3 hours ago" for recent posts, an absolute date once they age past a week. */
export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return 'unknown date';

  const diffSeconds = Math.round((then - Date.now()) / 1000);

  if (Math.abs(diffSeconds) < 60) return 'just now';
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return RELATIVE_TIME_FORMAT.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RELATIVE_TIME_FORMAT.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return RELATIVE_TIME_FORMAT.format(diffDays, 'day');

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
