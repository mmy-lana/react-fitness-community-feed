import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Challenge } from '../types/fitness';
import {
  CURRENT_USER_ID,
  getActivitiesSnapshot,
  getChallengesSnapshot,
  subscribeToStore,
  updateChallenges,
} from '../services/storageStore';

export interface ChallengeWithProgress extends Challenge {
  /** Sum of qualifying metrics inside the challenge window. */
  currentProgress: number;
  /** Capped at 100 so it is safe to feed a progress bar. */
  progressPercentage: number;
}

export interface UseChallengesResult {
  challenges: ChallengeWithProgress[];
  toggleJoin: (challengeId: string) => void;
}

/** Challenges plus their live progress, recomputed whenever an activity changes. */
export function useChallenges(): UseChallengesResult {
  const challenges = useSyncExternalStore(subscribeToStore, getChallengesSnapshot);
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);

  const challengesWithProgress = useMemo<ChallengeWithProgress[]>(() => {
    return challenges.map((challenge) => {
      const startTime = new Date(challenge.startDate).getTime();
      const endTime = new Date(challenge.endDate).getTime();
      let currentProgress = 0;

      for (const activity of activities) {
        if (activity.userId !== CURRENT_USER_ID) continue;
        if (!challenge.sportTypes.includes(activity.sportType)) continue;

        const activityTime = new Date(activity.startTime).getTime();
        if (activityTime < startTime || activityTime > endTime) continue;

        currentProgress +=
          challenge.metric === 'distance' ? activity.distanceMeters : activity.elevationGainMeters;
      }

      const ratio = challenge.targetValue > 0 ? (currentProgress / challenge.targetValue) * 100 : 0;

      return {
        ...challenge,
        currentProgress,
        progressPercentage: Math.min(100, Math.round(ratio)),
      };
    });
  }, [challenges, activities]);

  const toggleJoin = useCallback((challengeId: string) => {
    updateChallenges((previous) =>
      previous.map((challenge) => {
        if (challenge.id !== challengeId) return challenge;
        const joined = !challenge.joined;
        return {
          ...challenge,
          joined,
          participantCount: joined
            ? challenge.participantCount + 1
            : Math.max(0, challenge.participantCount - 1),
        };
      })
    );
  }, []);

  return { challenges: challengesWithProgress, toggleJoin };
}
