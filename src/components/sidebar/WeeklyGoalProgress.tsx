import type { SportType, WeeklyAggregates } from '../../types/fitness';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { SportIcon } from '../icons/SportIcons';

export interface WeeklyGoalProgressProps {
  stats: WeeklyAggregates;
  sport: SportType;
}

/** Ring gauge for the week's goal plus the supporting totals. */
export function WeeklyGoalProgress({ stats, sport }: WeeklyGoalProgressProps) {
  const RADIUS = 52;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  // `progressPercentage` is already capped at 100; `actualPercentage` is not.
  const dashOffset = CIRCUMFERENCE * (1 - stats.progressPercentage / 100);
  const isComplete = stats.progressPercentage >= 100;

  return (
    <section
      data-testid="weekly-goal"
      aria-label="Weekly goal"
      className="flex flex-col items-center gap-3 rounded-xl border border-surface-700/60 bg-surface-800 p-4"
    >
      <h2 className="text-sm font-bold text-ink-primary">This week</h2>

      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="64"
            cy="64"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            className="stroke-surface-700"
          />
          <circle
            cx="64"
            cy="64"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className={isComplete ? 'stroke-emerald-400' : 'stroke-strava-orange'}
          />
        </svg>

        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-ink-primary tabular-nums">
            {stats.actualPercentage}%
          </span>
          <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">of goal</span>
        </div>
      </div>

      <p className="text-center text-sm text-ink-secondary">
        <span className="font-bold text-ink-primary">
          {formatDistance(stats.totalDistanceMeters, sport)}
        </span>{' '}
        of {formatDistance(stats.targetDistanceMeters, sport)}
      </p>

      <dl className="grid w-full grid-cols-3 gap-2 border-t border-surface-700/60 pt-3 text-center">
        <div className="flex min-w-0 flex-col">
          <dt className="text-[11px] uppercase tracking-wider text-ink-tertiary">Activities</dt>
          <dd className="text-sm font-bold text-ink-primary tabular-nums">
            {stats.totalActivitiesCount}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-[11px] uppercase tracking-wider text-ink-tertiary">Time</dt>
          <dd className="text-sm font-bold text-ink-primary tabular-nums">
            {formatDuration(stats.totalDurationSeconds)}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-[11px] uppercase tracking-wider text-ink-tertiary">Elev</dt>
          <dd className="text-sm font-bold text-ink-primary tabular-nums">
            {Math.round(stats.totalElevationGainMeters)} m
          </dd>
        </div>
      </dl>

      <p className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
        <SportIcon sport={sport} className="w-3.5 h-3.5" />
        Counts {sport} distance from Monday
      </p>
    </section>
  );
}
