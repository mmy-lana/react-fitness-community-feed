import { useState } from 'react';
import type { ActivityFilterCriteria } from './types/fitness';
import { ActivityFeed } from './components/feed/ActivityFeed';
import { FilterBar } from './components/feed/FilterBar';
import { ManualActivityModal } from './components/forms/ManualActivityModal';
import { AppShell } from './components/layout/AppShell';
import { DESKTOP_QUERY } from './components/layout/Header';
import type { BottomNavItem } from './components/layout/BottomNav';
import { AthleteProfileCard } from './components/sidebar/AthleteProfileCard';
import { ChallengeCard } from './components/sidebar/ChallengeCard';
import { CommunityCard } from './components/sidebar/CommunityCard';
import { WeeklyGoalProgress } from './components/sidebar/WeeklyGoalProgress';
import { AlertIcon, RotateCcwIcon } from './components/icons/ActionIcons';
import { Button } from './components/ui/Button';
import { useActivities } from './hooks/useActivities';
import { useChallenges } from './hooks/useChallenges';
import { useMediaQuery } from './hooks/useMediaQuery';
import { addComment, deleteComment, toggleKudos } from './hooks/useSocial';
import { useWeeklyStats } from './hooks/useWeeklyStats';
import { CURRENT_USER_ID, STORAGE_ERROR_EVENT, getUserSnapshot, resetDemoData } from './services/storageStore';
import { useEffect } from 'react';

const DEFAULT_FILTERS: ActivityFilterCriteria = {
  sportType: 'all',
  sortBy: 'latest',
  dateRange: 'all',
  searchQuery: '',
};

export default function App() {
  const [filters, setFilters] = useState<ActivityFilterCriteria>(DEFAULT_FILTERS);
  const [isLogOpen, setLogOpen] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<BottomNavItem>('feed');

  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const { activities, totalCount, addActivity, deleteActivity } = useActivities(filters);
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

  const isFiltered =
    filters.sportType !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.searchQuery.trim() !== '';

  /** Clears a stale banner before running a mutation. */
  const runAction = (action: () => boolean): boolean => {
    setStorageError(null);
    return action();
  };

  const handleReset = () => {
    setStorageError(null);
    setFilters(DEFAULT_FILTERS);
    resetDemoData();
  };

  const athlete = {
    fullName: profile.fullName,
    username: profile.username,
    avatarInitials: profile.avatarInitials,
    location: profile.location,
  };

  const feedColumn = (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink-primary">Activity feed</h1>
        <span className="text-xs text-ink-tertiary">
          Week of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </header>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        visibleCount={activities.length}
        totalCount={totalCount}
      />

      <ActivityFeed
        activities={activities}
        currentUserId={CURRENT_USER_ID}
        isFiltered={isFiltered}
        onClearFilters={() => setFilters(DEFAULT_FILTERS)}
        onOpenLog={() => setLogOpen(true)}
        onToggleKudos={(activityId) => runAction(() => toggleKudos(activityId))}
        onDelete={(activityId) => runAction(() => deleteActivity(activityId))}
        onSubmitComment={(activityId, content) => runAction(() => addComment(activityId, content))}
        onDeleteComment={(activityId, commentId) => runAction(() => deleteComment(activityId, commentId))}
      />
    </div>
  );

  const progressColumn = (
    <div className="flex flex-col gap-4" data-nav-target="weekly">
      <div className="scroll-mt-20">
        <AthleteProfileCard profile={profile} />
      </div>
      <WeeklyGoalProgress stats={weeklyStats} sport={profile.weeklyGoalSport} />
    </div>
  );

  const resetButton = (
    <Button
      variant="ghost"
      fullWidth
      aria-label="Reset demo data"
      onClick={handleReset}
      iconLeft={<RotateCcwIcon className="w-4 h-4" />}
    >
      Reset demo data
    </Button>
  );

  const challengeColumn = (
    <>
      {challenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          currentProgress={challenge.currentProgress}
          progressPercentage={challenge.progressPercentage}
          onToggleJoin={toggleJoin}
        />
      ))}
      <CommunityCard />
    </>
  );

  return (
    <AppShell
      athlete={athlete}
      searchQuery={filters.searchQuery}
      onSearchChange={(searchQuery) => setFilters((previous) => ({ ...previous, searchQuery }))}
      onOpenLog={() => setLogOpen(true)}
      activeNavItem={activeNavItem}
      onNavigate={setActiveNavItem}
    >
      {storageError ? (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-sport-run/40 bg-sport-run/10 px-3 py-2 text-sm text-sport-run"
        >
          <AlertIcon className="mt-0.5 w-4 h-4 shrink-0" />
          {storageError}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:items-start">
        {isDesktop ? <aside className="flex min-w-0 flex-col gap-4">{progressColumn}{resetButton}</aside> : null}

        {feedColumn}

        <aside className="flex min-w-0 flex-col gap-4">
          {isDesktop ? null : progressColumn}
          {challengeColumn}
          {isDesktop ? null : resetButton}
        </aside>
      </div>

      <ManualActivityModal
        // Remount per session so a cancelled draft never leaks into the next one.
        key={isLogOpen ? 'log-open' : 'log-closed'}
        isOpen={isLogOpen}
        onClose={() => setLogOpen(false)}
        onSubmit={(input) => runAction(() => addActivity(input))}
      />
    </AppShell>
  );
}
