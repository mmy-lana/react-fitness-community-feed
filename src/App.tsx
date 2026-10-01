import { useEffect, useMemo, useState } from 'react';
import type { ActivityFilterCriteria, SportType } from './types/fitness';
import { ActivityCard } from './components/feed/ActivityCard';
import { ManualActivityModal } from './components/forms/ManualActivityModal';
import { AthleteProfileCard } from './components/sidebar/AthleteProfileCard';
import { ChallengeCard } from './components/sidebar/ChallengeCard';
import { WeeklyGoalProgress } from './components/sidebar/WeeklyGoalProgress';
import { AlertIcon, PlusIcon, RotateCcwIcon, SearchIcon } from './components/icons/ActionIcons';
import { Button } from './components/ui/Button';
import { useActivities } from './hooks/useActivities';
import { useChallenges } from './hooks/useChallenges';
import { addComment, deleteComment, toggleKudos } from './hooks/useSocial';
import { useWeeklyStats } from './hooks/useWeeklyStats';
import {
  CURRENT_USER_ID,
  STORAGE_ERROR_EVENT,
  getUserSnapshot,
  resetDemoData,
} from './services/storageStore';
import { getAthlete } from './utils/seedAthletes';
import { SPORT_LABEL_MAP, SPORT_TYPES } from './utils/sportMaps';

const DEFAULT_FILTERS: ActivityFilterCriteria = {
  sportType: 'all',
  sortBy: 'latest',
  dateRange: 'all',
  searchQuery: '',
};

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'distance', label: 'Distance' },
  { value: 'duration', label: 'Time' },
  { value: 'kudos', label: 'Kudos' },
] as const;

export default function App() {
  const [filters, setFilters] = useState<ActivityFilterCriteria>(DEFAULT_FILTERS);
  const [isLogOpen, setLogOpen] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const { activities, addActivity, deleteActivity } = useActivities(filters);
  const { challenges, toggleJoin } = useChallenges();
  const weeklyStats = useWeeklyStats();
  const profile = getUserSnapshot();

  // The store reports quota failures as a DOM event; surface them to the user.
  useEffect(() => {
    const onStorageError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setStorageError(typeof detail === 'string' ? detail : 'Browser storage is unavailable.');
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, []);

  const visibleCountLabel = useMemo(
    () => `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`,
    [activities.length]
  );

  /** Clears a stale banner before running a mutation. */
  const runAction = (action: () => boolean): boolean => {
    setStorageError(null);
    return action();
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-primary">Activity feed</h1>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            aria-label="Reset demo data"
            onClick={() => {
              setStorageError(null);
              resetDemoData();
            }}
            iconLeft={<RotateCcwIcon className="w-4 h-4" />}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            aria-label="Log activity"
            onClick={() => setLogOpen(true)}
            iconLeft={<PlusIcon className="w-4 h-4" />}
          >
            Log Activity
          </Button>
        </div>
      </div>

      {storageError ? (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-sport-run/40 bg-sport-run/10 px-3 py-2 text-sm text-sport-run"
        >
          <AlertIcon className="mt-0.5 w-4 h-4 shrink-0" />
          {storageError}
        </p>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex min-w-0 flex-1 items-center">
            <SearchIcon className="pointer-events-none absolute left-3 w-4 h-4 text-ink-tertiary" />
            <input
              type="search"
              value={filters.searchQuery}
              onChange={(event) => {
                // Read the value now: the updater runs during the next render,
                // by which time React has already cleared `currentTarget`.
                const { value } = event.currentTarget;
                setFilters((previous) => ({ ...previous, searchQuery: value }));
              }}
              aria-label="Search activities"
              placeholder="Search activities…"
              data-testid="feed-search"
              className="min-h-11 w-full rounded-lg border border-surface-600 bg-surface-800 pl-10 pr-3 text-base text-ink-primary placeholder:text-ink-tertiary focus:border-strava-orange/70 focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SORT_OPTIONS.map((sort) => (
              <Button
                key={sort.value}
                size="sm"
                variant={filters.sortBy === sort.value ? 'primary' : 'secondary'}
                aria-label={`Sort by ${sort.value}`}
                onClick={() => setFilters((previous) => ({ ...previous, sortBy: sort.value }))}
              >
                {sort.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filters.sportType === 'all' ? 'primary' : 'secondary'}
            aria-label="Filter by All"
            onClick={() => setFilters((previous) => ({ ...previous, sportType: 'all' }))}
          >
            All
          </Button>
          {SPORT_TYPES.map((sport: SportType) => (
            <Button
              key={sport}
              size="sm"
              variant={filters.sportType === sport ? 'primary' : 'secondary'}
              aria-label={`Filter by ${SPORT_LABEL_MAP[sport]}`}
              onClick={() => setFilters((previous) => ({ ...previous, sportType: sport }))}
            >
              {SPORT_LABEL_MAP[sport]}
            </Button>
          ))}
          <span className="ml-auto text-xs text-ink-tertiary">{visibleCountLabel}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              athlete={getAthlete(activity.userId)}
              currentUserId={CURRENT_USER_ID}
              onToggleKudos={(activityId) => runAction(() => toggleKudos(activityId))}
              onDelete={(activityId) => runAction(() => deleteActivity(activityId))}
              onSubmitComment={(activityId, content) => runAction(() => addComment(activityId, content))}
              onDeleteComment={(activityId, commentId) =>
                runAction(() => deleteComment(activityId, commentId))
              }
            />
          ))}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <AthleteProfileCard profile={profile} />
          <WeeklyGoalProgress stats={weeklyStats} sport={profile.weeklyGoalSport} />
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              currentProgress={challenge.currentProgress}
              progressPercentage={challenge.progressPercentage}
              onToggleJoin={toggleJoin}
            />
          ))}
        </aside>
      </div>

      <ManualActivityModal
        // Remount per session so a cancelled draft never leaks into the next one.
        key={isLogOpen ? 'log-open' : 'log-closed'}
        isOpen={isLogOpen}
        onClose={() => setLogOpen(false)}
        onSubmit={(input) => runAction(() => addActivity(input))}
      />
    </main>
  );
}
