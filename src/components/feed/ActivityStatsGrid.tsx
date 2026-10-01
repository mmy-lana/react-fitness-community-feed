import type { Activity } from '../../types/fitness';
import { calculatePaceOrSpeed, formatDistance, formatDuration } from '../../utils/formatters';
import { MetricPill } from '../ui/MetricPill';

export interface ActivityStatsGridProps {
  activity: Activity;
}

/**
 * Metric grid tuned for a 360px phone.
 *
 * Five metrics in two columns would leave an orphan, so the last metric spans
 * both columns below 390px and collapses to a single cell from 390px up, where
 * three columns fit. Workouts have no distance and get a two-metric layout.
 */
export function ActivityStatsGrid({ activity }: ActivityStatsGridProps) {
  const isWorkout = activity.sportType === 'workout';
  const duration = formatDuration(activity.durationSeconds);
  const calories = `${activity.calories} kcal`;

  if (isWorkout) {
    return (
      <div
        data-testid="activity-stats"
        className="my-3 grid grid-cols-2 gap-2 border-y border-surface-700/60 py-3"
      >
        <MetricPill label="Active Duration" value={duration} />
        <MetricPill label="Calories Burned" value={calories} />
      </div>
    );
  }

  const pace = calculatePaceOrSpeed(
    activity.durationSeconds,
    activity.distanceMeters,
    activity.sportType
  );

  return (
    <div
      data-testid="activity-stats"
      className="my-3 grid grid-cols-2 gap-2 border-y border-surface-700/60 py-3 xs:grid-cols-3"
    >
      <MetricPill
        label="Distance"
        value={formatDistance(activity.distanceMeters, activity.sportType)}
      />
      <MetricPill label="Time" value={duration} />
      <MetricPill
        label={activity.sportType === 'ride' ? 'Avg Speed' : 'Pace'}
        value={pace.value}
        unit={pace.unit}
      />
      <MetricPill label="Elev Gain" value={String(activity.elevationGainMeters)} unit="m" />
      {/* Orphan control: full width on a 2-column phone, single cell at 390px+. */}
      <div className="col-span-2 xs:col-span-1">
        <MetricPill label="Calories" value={calories} />
      </div>
    </div>
  );
}
