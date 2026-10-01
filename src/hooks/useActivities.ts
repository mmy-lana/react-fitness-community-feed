import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type {
  Activity,
  ActivityFilterCriteria,
  NewActivityInput,
  SportType,
} from '../types/fitness';
import {
  CURRENT_USER_ID,
  generateSafeId,
  getActivitiesSnapshot,
  subscribeToStore,
  updateActivities,
} from '../services/storageStore';
import { getStartOfMonth, getStartOfWeek } from '../utils/dateHelpers';
import { generateSyntheticRoute } from '../utils/routeGenerator';
import { calculateCalories } from '../utils/telemetryMath';

export interface UseActivitiesResult {
  /** Feed after privacy, sport, search and date filtering. */
  activities: Activity[];
  /** Everything persisted, before filtering. */
  totalCount: number;
  /** Returns false when the write failed, e.g. the storage quota is full. */
  addActivity: (input: NewActivityInput) => boolean;
  /** Ownership guarded: another athlete's activity is never removed. */
  deleteActivity: (activityId: string) => boolean;
}

export const DEFAULT_FILTERS: ActivityFilterCriteria = {
  sportType: 'all',
  sortBy: 'latest',
  dateRange: 'all',
  searchQuery: '',
};

/**
 * The community feed query plus the two mutations that act on it.
 *
 * Memoised on the individual filter fields rather than the filter object, so a
 * caller that builds its criteria inline does not re-filter on every render.
 */
export function useActivities(filters: ActivityFilterCriteria = DEFAULT_FILTERS): UseActivitiesResult {
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);

  const { sportType, sortBy, dateRange, searchQuery } = filters;

  const filteredActivities = useMemo(() => {
    // Privacy guard: your own posts are always visible, everyone else's only
    // when they are public.
    const visible = activities.filter(
      (activity) => activity.userId === CURRENT_USER_ID || activity.privacy === 'public'
    );

    const bySport =
      sportType === 'all' ? visible : visible.filter((activity) => activity.sportType === sportType);

    const query = searchQuery.trim().toLowerCase();
    const bySearch = query
      ? bySport.filter(
          (activity) =>
            activity.title.toLowerCase().includes(query) ||
            activity.description.toLowerCase().includes(query)
          )
        : bySport;

    const byDate = (() => {
      if (dateRange === 'this_week') {
        const start = getStartOfWeek();
        return bySearch.filter((activity) => new Date(activity.startTime).getTime() >= start);
      }
      if (dateRange === 'this_month') {
        const start = getStartOfMonth();
        return bySearch.filter((activity) => new Date(activity.startTime).getTime() >= start);
      }
      return bySearch;
    })();

    // Every comparator falls back to newest-first, so ties are deterministic.
    return [...byDate].sort((a, b) => {
      if (sortBy === 'distance' && a.distanceMeters !== b.distanceMeters) {
        return b.distanceMeters - a.distanceMeters;
      }
      if (sortBy === 'duration' && a.durationSeconds !== b.durationSeconds) {
        return b.durationSeconds - a.durationSeconds;
      }
      if (sortBy === 'kudos' && a.kudos.length !== b.kudos.length) {
        return b.kudos.length - a.kudos.length;
      }
      const byStart = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      if (byStart !== 0) return byStart;
      return a.id < b.id ? -1 : 1;
    });
  }, [activities, sportType, sortBy, dateRange, searchQuery]);

  const addActivity = useCallback((input: NewActivityInput): boolean => {
    const isWorkout = input.sportType === 'workout';
    const distanceMeters = isWorkout || input.routePattern === 'stationary' ? 0 : input.distanceMeters;
    const elevationGainMeters = isWorkout ? 0 : input.elevationGainMeters;
    const now = new Date().toISOString();

    const activity: Activity = {
      id: generateSafeId('act'),
      userId: CURRENT_USER_ID,
      title: input.title.trim(),
      description: input.description.trim(),
      sportType: input.sportType as SportType,
      startTime: input.startTime || now,
      durationSeconds: input.durationSeconds,
      distanceMeters,
      elevationGainMeters,
      calories: calculateCalories(input.durationSeconds, input.sportType),
      // The route is synthesized locally and is empty for stationary sessions.
      coordinates: generateSyntheticRoute(
        input.routePattern,
        distanceMeters,
        elevationGainMeters,
        Date.now()
      ),
      kudos: [],
      comments: [],
      privacy: input.privacy,
      createdAt: now,
      updatedAt: now,
    };

    return updateActivities((previous) => [activity, ...previous]);
  }, []);

  const deleteActivity = useCallback((activityId: string): boolean => {
    let removed = false;
    updateActivities((previous) => {
      const next = previous.filter((activity) => {
        if (activity.id !== activityId) return true;
        // Ownership guard: only the author can delete their post.
        if (activity.userId !== CURRENT_USER_ID) return true;
        removed = true;
        return false;
      });
      return next;
    });
    return removed;
  }, []);

  return {
    activities: filteredActivities,
    totalCount: activities.length,
    addActivity,
    deleteActivity,
  };
}
