import type { Activity } from '../../types/fitness';
import { getAthlete } from '../../utils/seedAthletes';
import { ActivityCard } from './ActivityCard';
import { PlusIcon, RotateCcwIcon, SearchIcon } from '../icons/ActionIcons';
import { Button } from '../ui/Button';

export interface ActivityFeedProps {
  activities: Activity[];
  currentUserId: string;
  /** True when a sport, date or search filter is narrowing the list. */
  isFiltered: boolean;
  onClearFilters: () => void;
  onOpenLog: () => void;
  onToggleKudos: (activityId: string) => void;
  onDelete: (activityId: string) => void;
  onSubmitComment: (activityId: string, content: string) => boolean;
  onDeleteComment: (activityId: string, commentId: string) => boolean;
}

/**
 * The feed column. Author details are resolved through the athlete directory,
 * so a post whose author is not in the directory still renders a complete
 * header instead of a blank one.
 */
export function ActivityFeed({
  activities,
  currentUserId,
  isFiltered,
  onClearFilters,
  onOpenLog,
  onToggleKudos,
  onDelete,
  onSubmitComment,
  onDeleteComment,
}: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <section
        id="activity-feed"
        data-testid="activity-feed"
        data-nav-target="feed"
        aria-label="Activity feed"
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-600 px-6 py-14 text-center"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-800 text-ink-tertiary">
          {isFiltered ? (
            <SearchIcon className="h-6 w-6" />
          ) : (
            <PlusIcon className="h-6 w-6" />
          )}
        </span>

        <h2 className="text-base font-bold text-ink-primary">
          {isFiltered ? 'No activities match these filters' : 'Your feed is empty'}
        </h2>
        <p className="max-w-sm text-sm text-ink-secondary">
          {isFiltered
            ? 'Try a different sport, widen the date range, or clear the search to see everything again.'
            : 'Log your first activity to start the feed. Your tracks, elevation and kudos show up here.'}
        </p>

        <Button
          variant={isFiltered ? 'secondary' : 'primary'}
          onClick={isFiltered ? onClearFilters : onOpenLog}
          iconLeft={
            isFiltered ? <RotateCcwIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />
          }
        >
          {isFiltered ? 'Clear filters' : 'Log an activity'}
        </Button>
      </section>
    );
  }

  return (
    <section
      id="activity-feed"
      data-testid="activity-feed"
      data-nav-target="feed"
      aria-label="Activity feed"
      className="flex min-w-0 scroll-mt-20 flex-col gap-4"
    >
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          athlete={getAthlete(activity.userId)}
          currentUserId={currentUserId}
          onToggleKudos={onToggleKudos}
          onDelete={onDelete}
          onSubmitComment={onSubmitComment}
          onDeleteComment={onDeleteComment}
        />
      ))}
    </section>
  );
}
