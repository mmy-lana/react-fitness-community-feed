import { useSyncExternalStore } from 'react';
import type { Activity, Challenge, SportType, WeeklyAggregates } from './types/fitness';
import { ActivityCard } from './components/feed/ActivityCard';
import { AthleteProfileCard } from './components/sidebar/AthleteProfileCard';
import { ChallengeCard } from './components/sidebar/ChallengeCard';
import { WeeklyGoalProgress } from './components/sidebar/WeeklyGoalProgress';
import {
  CURRENT_USER_ID,
  getActivitiesSnapshot,
  getChallengesSnapshot,
  getUserSnapshot,
  subscribeToStore,
} from './services/storageStore';
import { getAthlete } from './utils/seedAthletes';
import { getStartOfWeek } from './utils/dateHelpers';

/**
 * Feed and sidebar preview over the seeded dataset. Wiring to live mutations
 * arrives with the domain hooks; this milestone only proves the presentational
 * layer renders correctly at every breakpoint.
 */
function usePreviewData() {
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);
  const challenges = useSyncExternalStore(subscribeToStore, getChallengesSnapshot);
  const user = useSyncExternalStore(subscribeToStore, getUserSnapshot);
  return { activities, challenges, user };
}

function computeWeeklyStats(
  activities: Activity[],
  goalSport: SportType,
  targetDistanceMeters: number
): WeeklyAggregates {
  const startOfWeek = getStartOfWeek();
  let totalDistance = 0;
  let totalDuration = 0;
  let totalElevation = 0;
  let count = 0;

  for (const activity of activities) {
    if (activity.userId !== CURRENT_USER_ID) continue;
    if (new Date(activity.startTime).getTime() < startOfWeek) continue;
    if (activity.sportType === goalSport) totalDistance += activity.distanceMeters;
    totalDuration += activity.durationSeconds;
    totalElevation += activity.elevationGainMeters;
    count += 1;
  }

  const ratio = targetDistanceMeters > 0 ? (totalDistance / targetDistanceMeters) * 100 : 0;

  return {
    totalDistanceMeters: totalDistance,
    totalDurationSeconds: totalDuration,
    totalElevationGainMeters: totalElevation,
    totalActivitiesCount: count,
    targetDistanceMeters,
    progressPercentage: Math.min(100, Math.round(ratio)),
    actualPercentage: Math.round(ratio),
  };
}

function challengeProgress(challenge: Challenge, activities: Activity[]) {
  const start = new Date(challenge.startDate).getTime();
  const end = new Date(challenge.endDate).getTime();
  let progress = 0;

  for (const activity of activities) {
    if (activity.userId !== CURRENT_USER_ID) continue;
    const time = new Date(activity.startTime).getTime();
    if (time < start || time > end || !challenge.sportTypes.includes(activity.sportType)) continue;
    progress += challenge.metric === 'distance' ? activity.distanceMeters : activity.elevationGainMeters;
  }

  const ratio = challenge.targetValue > 0 ? (progress / challenge.targetValue) * 100 : 0;
  return { currentProgress: progress, progressPercentage: Math.min(100, Math.round(ratio)) };
}

export default function App() {
  const { activities, challenges, user } = usePreviewData();
  const weekly = computeWeeklyStats(activities, user.weeklyGoalSport, user.weeklyGoalMeters);
  const sorted = [...activities].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <h1 className="mb-4 text-xl font-bold text-ink-primary">Activity feed</h1>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {sorted.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              athlete={getAthlete(activity.userId)}
              currentUserId={CURRENT_USER_ID}
              onToggleKudos={() => undefined}
            />
          ))}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <AthleteProfileCard profile={user} />
          <WeeklyGoalProgress stats={weekly} sport={user.weeklyGoalSport} />
          {challenges.map((challenge) => {
            const progress = challengeProgress(challenge, activities);
            return <ChallengeCard key={challenge.id} challenge={challenge} {...progress} />;
          })}
        </aside>
      </div>
    </main>
  );
}
