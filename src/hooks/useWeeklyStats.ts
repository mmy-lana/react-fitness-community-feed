import { useMemo, useSyncExternalStore } from 'react';
import type { WeeklyAggregates } from '../types/fitness';
import {
  CURRENT_USER_ID,
  getActivitiesSnapshot,
  getUserSnapshot,
  subscribeToStore,
} from '../services/storageStore';
import { getStartOfWeek } from '../utils/dateHelpers';

/**
 * Rolls up the signed-in athlete's week, starting Monday 00:00 local time.
 *
 * Distance only counts the sport the goal is set in; time, elevation and the
 * activity count include everything the athlete logged.
 */
export function useWeeklyStats(): WeeklyAggregates {
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);
  const user = useSyncExternalStore(subscribeToStore, getUserSnapshot);

  return useMemo(() => {
    const startOfWeekTime = getStartOfWeek();

    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    let totalElevationGainMeters = 0;
    let totalActivitiesCount = 0;

    for (const activity of activities) {
      if (activity.userId !== CURRENT_USER_ID) continue;
      if (new Date(activity.startTime).getTime() < startOfWeekTime) continue;

      if (activity.sportType === user.weeklyGoalSport) {
        totalDistanceMeters += activity.distanceMeters;
      }
      totalDurationSeconds += activity.durationSeconds;
      totalElevationGainMeters += activity.elevationGainMeters;
      totalActivitiesCount += 1;
    }

    const targetDistanceMeters = user.weeklyGoalMeters || 50000;
    const ratio =
      targetDistanceMeters > 0 ? (totalDistanceMeters / targetDistanceMeters) * 100 : 0;

    return {
      totalDistanceMeters,
      totalDurationSeconds,
      totalElevationGainMeters,
      totalActivitiesCount,
      targetDistanceMeters,
      // Capped for the gauge; the raw value is what the headline reports.
      progressPercentage: Math.min(100, Math.round(ratio)),
      actualPercentage: Math.round(ratio),
    };
  }, [activities, user]);
}
