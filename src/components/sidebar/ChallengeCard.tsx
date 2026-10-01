import type { Challenge } from '../../types/fitness';
import { formatDistance } from '../../utils/formatters';
import { SPORT_LABEL_MAP } from '../../utils/sportMaps';
import { CalendarIcon, CheckIcon, TrophyIcon } from '../icons/ActionIcons';
import { SportIcon } from '../icons/SportIcons';
import { Button } from '../ui/Button';

export interface ChallengeCardProps {
  challenge: Challenge;
  /** Sum of qualifying activity metrics inside the challenge window. */
  currentProgress: number;
  /** Capped at 100 for the progress bar. */
  progressPercentage: number;
  onToggleJoin?: (challengeId: string) => void;
}

function formatMetric(value: number, metric: Challenge['metric'], sport: Challenge['sportTypes'][number]): string {
  return metric === 'elevation' ? `${Math.round(value)} m` : formatDistance(value, sport);
}

function formatWindow(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${month.format(start)} ${start.getDate()}–${end.getDate()}`
    : `${month.format(start)} ${start.getDate()} – ${month.format(end)} ${end.getDate()}`;
}

/** One challenge with its live progress toward the target. */
export function ChallengeCard({
  challenge,
  currentProgress,
  progressPercentage,
  onToggleJoin,
}: ChallengeCardProps) {
  const primarySport = challenge.sportTypes[0];
  const isComplete = progressPercentage >= 100;

  return (
    <section
      data-testid="challenge-card"
      data-challenge-id={challenge.id}
      data-joined={challenge.joined}
      aria-label={challenge.title}
      className="flex flex-col gap-2.5 rounded-xl border border-surface-700/60 bg-surface-800 p-4"
    >
      <div className="flex items-start gap-2">
        <TrophyIcon
          className={`mt-0.5 w-4 h-4 shrink-0 ${isComplete ? 'text-emerald-400' : 'text-strava-orange'}`}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm leading-snug font-bold text-ink-primary">{challenge.title}</h3>
          <p className="text-xs leading-relaxed text-ink-secondary">{challenge.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {challenge.sportTypes.map((sport) => (
          <span
            key={sport}
            className="inline-flex items-center gap-1 rounded-full border border-surface-600 bg-surface-700 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary"
          >
            <SportIcon sport={sport} className="w-3 h-3" />
            {SPORT_LABEL_MAP[sport]}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink-primary tabular-nums">
            {formatMetric(currentProgress, challenge.metric, primarySport)}{' '}
            <span className="font-normal text-ink-tertiary">
              / {formatMetric(challenge.targetValue, challenge.metric, primarySport)}
            </span>
          </span>
          <span className="text-ink-tertiary tabular-nums">{progressPercentage}%</span>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercentage}
          aria-label={`${challenge.title} progress`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-700"
        >
          <div
            className={`h-full rounded-full ${isComplete ? 'bg-emerald-400' : 'bg-strava-orange'}`}
            style={{ width: `${Math.max(progressPercentage, currentProgress > 0 ? 3 : 0)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-surface-700/60 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-ink-tertiary">
          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
          {formatWindow(challenge.startDate, challenge.endDate)}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{challenge.participantCount.toLocaleString('en-US')} joined</span>
        </span>

        {onToggleJoin ? (
          <Button
            variant={challenge.joined ? 'secondary' : 'primary'}
            size="sm"
            data-testid="challenge-toggle"
            data-joined={challenge.joined}
            aria-pressed={challenge.joined}
            onClick={() => onToggleJoin(challenge.id)}
            className="shrink-0"
            iconLeft={challenge.joined ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : undefined}
          >
            {challenge.joined ? 'Joined' : 'Join'}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
