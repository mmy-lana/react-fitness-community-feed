import type { Activity, Challenge, UserProfile } from '../types/fitness';
import { CURRENT_USER_ID } from '../utils/seedAthletes';
import { generateSyntheticRoute } from '../utils/routeGenerator';
import { calculateCalories } from '../utils/telemetryMath';

export { CURRENT_USER_ID } from '../utils/seedAthletes';

/**
 * The single reactive store behind the whole app.
 *
 * Every consumer reads through `useSyncExternalStore`, which requires two
 * guarantees this module provides:
 *
 * 1. **Reference-stable snapshots.** A getter never returns a new array unless
 *    the persisted JSON actually changed, so React can compare with `Object.is`.
 * 2. **Read-modify-write updaters.** Mutations re-read localStorage at call
 *    time, so two components writing in the same tick cannot clobber each other.
 */

/** Namespaced so a `storage` event from an unrelated app is ignored. */
const STORAGE_KEY_PREFIX = 'fitness:';
const ACTIVITIES_KEY = `${STORAGE_KEY_PREFIX}activities`;
const USER_KEY = `${STORAGE_KEY_PREFIX}user`;
const CHALLENGES_KEY = `${STORAGE_KEY_PREFIX}challenges`;
const SEEDED_KEY = `${STORAGE_KEY_PREFIX}seeded`;

/** Same-tab notification channel: the `storage` event only fires cross-tab. */
const SYNC_EVENT = 'fitness_store_sync';

/** Dispatched on a failed write so the UI can surface quota errors. */
export const STORAGE_ERROR_EVENT = 'fitness_storage_error';

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dispatchStorageError(detail: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(STORAGE_ERROR_EVENT, { detail }));
}

/** Writes and announces in one step so same-tab subscribers stay in sync. */
function broadcastLocalChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
  notify();
}

/** Never throws: corrupted JSON degrades to the caller's fallback. */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed === null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function createDefaultUserProfile(): UserProfile {
  return {
    id: CURRENT_USER_ID,
    username: 'marathoner_alex',
    fullName: 'Alex Reynolds',
    location: 'San Francisco, CA',
    bio: 'Endurance runner and weekend gravel grinder. Chasing sub-3 marathon.',
    avatarInitials: 'AR',
    followingCount: 142,
    followersCount: 289,
    weeklyGoalMeters: 45000,
    weeklyGoalSport: 'run',
    createdAt: new Date().toISOString(),
  };
}

/** Raw strings are the cache key; parsed values are the cached snapshots. */
let rawActivitiesString: string | null = null;
let parsedActivitiesCache: Activity[] = [];

let rawUserString: string | null = null;
let parsedUserCache: UserProfile = createDefaultUserProfile();

let rawChallengesString: string | null = null;
let parsedChallengesCache: Challenge[] = [];

export function getActivitiesSnapshot(): Activity[] {
  if (typeof window === 'undefined') return parsedActivitiesCache;
  const currentRaw = window.localStorage.getItem(ACTIVITIES_KEY);
  if (currentRaw !== rawActivitiesString) {
    rawActivitiesString = currentRaw;
    parsedActivitiesCache = safeParse<Activity[]>(currentRaw, []);
  }
  return parsedActivitiesCache;
}

export function getUserSnapshot(): UserProfile {
  if (typeof window === 'undefined') return parsedUserCache;
  const currentRaw = window.localStorage.getItem(USER_KEY);
  if (currentRaw !== rawUserString) {
    rawUserString = currentRaw;
    parsedUserCache = safeParse<UserProfile>(currentRaw, parsedUserCache);
  }
  return parsedUserCache;
}

export function getChallengesSnapshot(): Challenge[] {
  if (typeof window === 'undefined') return parsedChallengesCache;
  const currentRaw = window.localStorage.getItem(CHALLENGES_KEY);
  if (currentRaw !== rawChallengesString) {
    rawChallengesString = currentRaw;
    parsedChallengesCache = safeParse<Challenge[]>(currentRaw, []);
  }
  return parsedChallengesCache;
}

/**
 * Atomic list mutation: re-reads the persisted value, applies the updater, then
 * persists. Returns `false` when the write failed (quota, private mode, ...).
 */
export function updateActivities(updater: (prev: Activity[]) => Activity[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const prev = safeParse<Activity[]>(window.localStorage.getItem(ACTIVITIES_KEY), []);
    const next = updater(prev);
    window.localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(next));
    broadcastLocalChange();
    return true;
  } catch (error) {
    console.error('Storage write error (activities):', error);
    dispatchStorageError('Could not save your activity. Browser storage may be full.');
    return false;
  }
}

export function updateUser(updater: (prev: UserProfile) => UserProfile): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const prev = safeParse<UserProfile>(window.localStorage.getItem(USER_KEY), parsedUserCache);
    const next = updater(prev);
    window.localStorage.setItem(USER_KEY, JSON.stringify(next));
    broadcastLocalChange();
    return true;
  } catch (error) {
    console.error('Storage write error (user):', error);
    dispatchStorageError('Could not save your profile. Browser storage may be full.');
    return false;
  }
}

export function updateChallenges(updater: (prev: Challenge[]) => Challenge[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const prev = safeParse<Challenge[]>(window.localStorage.getItem(CHALLENGES_KEY), []);
    const next = updater(prev);
    window.localStorage.setItem(CHALLENGES_KEY, JSON.stringify(next));
    broadcastLocalChange();
    return true;
  } catch (error) {
    console.error('Storage write error (challenges):', error);
    dispatchStorageError('Could not update your challenges. Browser storage may be full.');
    return false;
  }
}

/**
 * Collision-resistant id that still works over plain HTTP on a LAN, where
 * `crypto.randomUUID` is unavailable in insecure contexts.
 */
export function generateSafeId(prefix: string = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `${prefix}-${crypto.randomUUID()}`;
    } catch {
      // Fall through to the non-cryptographic generator below.
    }
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Clears every persisted key and reseeds the demo dataset. */
export function resetDemoData(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SEEDED_KEY);
    window.localStorage.removeItem(ACTIVITIES_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(CHALLENGES_KEY);
  } catch (error) {
    console.error('Storage reset error:', error);
    dispatchStorageError('Could not reset the demo data.');
    return;
  }
  initializeSeedData();
  broadcastLocalChange();
}

/**
 * Writes the starter feed on first load only. Timestamps are relative to "now"
 * so relative-time labels and the weekly roll-up always have live data.
 */
export function initializeSeedData(): void {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(SEEDED_KEY) === 'true') return;

    const now = Date.now();
    const ONE_HOUR = 3600 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;

    const ridgeRunId = generateSafeId('act');
    const headlandsRideId = generateSafeId('act');
    const aquaticParkSwimId = generateSafeId('act');
    const tamScrambleId = generateSafeId('act');
    const conditioningId = generateSafeId('act');

    const seedActivities: Activity[] = [
      {
        id: ridgeRunId,
        userId: CURRENT_USER_ID,
        title: 'Sunrise Ridge Trail Run',
        description: 'Cool crisp morning tempo on the western ridge trail. Felt strong on the inclines.',
        sportType: 'run',
        startTime: new Date(now - 3 * ONE_HOUR).toISOString(),
        durationSeconds: 3120,
        distanceMeters: 10450,
        elevationGainMeters: 285,
        calories: calculateCalories(3120, 'run'),
        coordinates: generateSyntheticRoute('climb', 10450, 285, 101),
        kudos: [
          {
            userId: 'user-02',
            username: 'Elena Rostova',
            timestamp: new Date(now - 2 * ONE_HOUR).toISOString(),
          },
          {
            userId: 'user-03',
            username: 'Marcus Vance',
            timestamp: new Date(now - 1 * ONE_HOUR).toISOString(),
          },
        ],
        comments: [
          {
            id: generateSafeId('cmt'),
            activityId: ridgeRunId,
            userId: 'user-02',
            userName: 'Elena Rostova',
            content: 'Cracking pace up that climb!',
            createdAt: new Date(now - 2 * ONE_HOUR).toISOString(),
          },
        ],
        privacy: 'public',
        createdAt: new Date(now - 3 * ONE_HOUR).toISOString(),
        updatedAt: new Date(now - 3 * ONE_HOUR).toISOString(),
      },
      {
        id: headlandsRideId,
        userId: 'user-02',
        title: 'Marin Headlands Coastal Loop',
        description: 'Headwind on the bridge return, but spectacular visibility over the bay.',
        sportType: 'ride',
        startTime: new Date(now - 18 * ONE_HOUR).toISOString(),
        durationSeconds: 6840,
        distanceMeters: 52300,
        elevationGainMeters: 640,
        calories: calculateCalories(6840, 'ride'),
        coordinates: generateSyntheticRoute('loop', 52300, 640, 202),
        kudos: [
          {
            userId: CURRENT_USER_ID,
            username: 'Alex Reynolds',
            timestamp: new Date(now - 16 * ONE_HOUR).toISOString(),
          },
        ],
        comments: [],
        privacy: 'public',
        createdAt: new Date(now - 18 * ONE_HOUR).toISOString(),
        updatedAt: new Date(now - 18 * ONE_HOUR).toISOString(),
      },
      {
        id: aquaticParkSwimId,
        userId: 'user-03',
        title: 'Aquatic Park Open Water Laps',
        description: 'Chilly 14C water. Sighting practice between buoys.',
        sportType: 'swim',
        startTime: new Date(now - 1 * ONE_DAY).toISOString(),
        durationSeconds: 2280,
        distanceMeters: 1800,
        elevationGainMeters: 0,
        calories: calculateCalories(2280, 'swim'),
        coordinates: generateSyntheticRoute('out_and_back', 1800, 0, 303),
        kudos: [],
        comments: [],
        privacy: 'public',
        createdAt: new Date(now - 1 * ONE_DAY).toISOString(),
        updatedAt: new Date(now - 1 * ONE_DAY).toISOString(),
      },
      {
        id: tamScrambleId,
        userId: CURRENT_USER_ID,
        title: 'Mount Tamalpais Summit Scramble',
        description: 'Steep grades, rocky terrain. Heavy pack day.',
        sportType: 'hike',
        startTime: new Date(now - 2 * ONE_DAY).toISOString(),
        durationSeconds: 10800,
        distanceMeters: 14200,
        elevationGainMeters: 780,
        calories: calculateCalories(10800, 'hike'),
        coordinates: generateSyntheticRoute('climb', 14200, 780, 404),
        kudos: [
          {
            userId: 'user-02',
            username: 'Elena Rostova',
            timestamp: new Date(now - 2 * ONE_DAY + ONE_HOUR).toISOString(),
          },
        ],
        comments: [],
        privacy: 'followers',
        createdAt: new Date(now - 2 * ONE_DAY).toISOString(),
        updatedAt: new Date(now - 2 * ONE_DAY).toISOString(),
      },
      {
        id: conditioningId,
        userId: CURRENT_USER_ID,
        title: 'Core & Kettlebell Conditioning',
        description: '5 rounds: swings, Turkish get-ups, goblet squats, and planks.',
        sportType: 'workout',
        startTime: new Date(now - 3 * ONE_DAY).toISOString(),
        durationSeconds: 2700,
        distanceMeters: 0,
        elevationGainMeters: 0,
        calories: calculateCalories(2700, 'workout'),
        coordinates: [],
        kudos: [],
        comments: [],
        privacy: 'private',
        createdAt: new Date(now - 3 * ONE_DAY).toISOString(),
        updatedAt: new Date(now - 3 * ONE_DAY).toISOString(),
      },
    ];

    const seedChallenges: Challenge[] = [
      {
        id: 'challenge-run-100k',
        title: 'October Run 100k Challenge',
        description: 'Log 100 kilometers of running this month to claim the digital badge.',
        metric: 'distance',
        sportTypes: ['run'],
        targetValue: 100000,
        startDate: new Date(now - 10 * ONE_DAY).toISOString(),
        endDate: new Date(now + 20 * ONE_DAY).toISOString(),
        joined: true,
        participantCount: 14328,
        badgeCode: 'RUN100K_OCT',
      },
      {
        id: 'challenge-ride-250k',
        title: 'Autumn Gran Fondo 250k',
        description: 'Ride 250 km within the challenge window.',
        metric: 'distance',
        sportTypes: ['ride'],
        targetValue: 250000,
        startDate: new Date(now - 5 * ONE_DAY).toISOString(),
        endDate: new Date(now + 25 * ONE_DAY).toISOString(),
        joined: false,
        participantCount: 8940,
        badgeCode: 'RIDE250K_OCT',
      },
      {
        id: 'challenge-climb-2000m',
        title: 'Elevation Challenge: 2,000m Up',
        description: 'Ascend a total of 2,000 meters across runs, rides, or hikes.',
        metric: 'elevation',
        sportTypes: ['run', 'ride', 'hike'],
        targetValue: 2000,
        startDate: new Date(now - 3 * ONE_DAY).toISOString(),
        endDate: new Date(now + 27 * ONE_DAY).toISOString(),
        joined: true,
        participantCount: 5210,
        badgeCode: 'CLIMB2K_OCT',
      },
    ];

    window.localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(seedActivities));
    window.localStorage.setItem(USER_KEY, JSON.stringify(parsedUserCache));
    window.localStorage.setItem(CHALLENGES_KEY, JSON.stringify(seedChallenges));
    window.localStorage.setItem(SEEDED_KEY, 'true');
  } catch (error) {
    console.error('Storage seeding error:', error);
    dispatchStorageError('Could not prepare the demo dataset.');
  }
}

if (typeof window !== 'undefined') {
  // Another tab or the same-tab sync channel changed our data.
  window.addEventListener('storage', (event) => {
    // event.key === null means localStorage.clear() ran somewhere else.
    if (event.key === null || event.key.startsWith(STORAGE_KEY_PREFIX)) {
      notify();
    }
  });

  window.addEventListener(SYNC_EVENT, () => {
    notify();
  });

  initializeSeedData();
}
