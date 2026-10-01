import type { SportType } from '../types/fitness';

/**
 * Sport styling is expressed as exhaustive static records rather than
 * interpolated class names (`bg-sport-${sport}`), which Tailwind v4 cannot
 * detect at build time. Adding a sport to the union therefore forces a compile
 * error here instead of shipping an unstyled card.
 */

/** Text colour for sport accents. */
export const SPORT_COLOR_MAP: Record<SportType, string> = {
  run: 'text-sport-run',
  ride: 'text-sport-ride',
  swim: 'text-sport-swim',
  hike: 'text-sport-hike',
  workout: 'text-sport-workout',
};

/** Tinted chip: background, text and border in one token. */
export const SPORT_BG_MAP: Record<SportType, string> = {
  run: 'bg-sport-run/15 text-sport-run border-sport-run/30',
  ride: 'bg-sport-ride/15 text-sport-ride border-sport-ride/30',
  swim: 'bg-sport-swim/15 text-sport-swim border-sport-swim/30',
  hike: 'bg-sport-hike/15 text-sport-hike border-sport-hike/30',
  workout: 'bg-sport-workout/15 text-sport-workout border-sport-workout/30',
};

/** Solid fill for the sport badge dot. */
export const SPORT_SOLID_MAP: Record<SportType, string> = {
  run: 'bg-sport-run',
  ride: 'bg-sport-ride',
  swim: 'bg-sport-swim',
  hike: 'bg-sport-hike',
  workout: 'bg-sport-workout',
};

/** Human-readable sport name used in labels, filters and form options. */
export const SPORT_LABEL_MAP: Record<SportType, string> = {
  run: 'Run',
  ride: 'Ride',
  swim: 'Swim',
  hike: 'Hike',
  workout: 'Workout',
};

/** Every sport in display order — the canonical filter and select order. */
export const SPORT_TYPES: readonly SportType[] = ['run', 'ride', 'swim', 'hike', 'workout'];

/** Sports whose distance is measured in pool meters rather than kilometers. */
export const METRIC_SPORTS: Record<SportType, boolean> = {
  run: false,
  ride: false,
  swim: true,
  hike: false,
  workout: false,
};
