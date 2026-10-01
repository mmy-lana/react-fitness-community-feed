# Architectural Specification & Execution Plan: Fitness Community & Activity Feed App (`react-fitness-community-feed`)

---

## 1. System Architecture & Foundation

### 1.1. Core Technology Stack
* **Framework:** React (Latest) with TypeScript (Strict Mode)
* **Build Tool:** Vite (Latest)
* **Styling Engine:** Tailwind CSS (Latest v4) via `@tailwindcss/vite`
* **Type System Rules:** Strict module boundaries, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, relative imports only, no TypeScript enums or namespaces.
* **Component Model:** React 19 functional conventions (`ref` passed as a direct prop, explicit initial `useRef<T>(null)`, typed `React.ReactNode` children, zero `forwardRef` wrappers).

### 1.2. Tailwind v4 Theme Tokens (`src/index.css`)
No `tailwind.config.js` or PostCSS files are used. Configuration is declared directly in CSS via the `@theme` directive:

```css
@import "tailwindcss";

@theme {
  --color-strava-orange: #FC4C02;
  --color-strava-orange-hover: #E34402;
  
  --color-surface-900: #121214;
  --color-surface-800: #1A1A1E;
  --color-surface-700: #24242A;
  --color-surface-600: #2E2E36;
  
  --color-ink-primary: #F4F4F6;
  --color-ink-secondary: #A1A1AA;
  --color-ink-tertiary: #71717A;

  --color-sport-run: #FC4C02;
  --color-sport-ride: #00A3FF;
  --color-sport-swim: #00E5FF;
  --color-sport-hike: #10B981;
  --color-sport-workout: #A855F7;

  --breakpoint-xs: 390px;
}
```

### 1.3. Static Sport Lookup Maps
Dynamic class interpolation (e.g., `bg-sport-${sport}`) is prohibited to ensure reliable compilation under Tailwind v4. All sport-keyed styles utilize exhaustive static record maps:

```typescript
// utils/sportMaps.ts
import type { SportType } from '../types/fitness';

export const SPORT_COLOR_MAP: Record<SportType, string> = {
  run: 'text-sport-run',
  ride: 'text-sport-ride',
  swim: 'text-sport-swim',
  hike: 'text-sport-hike',
  workout: 'text-sport-workout',
};

export const SPORT_BG_MAP: Record<SportType, string> = {
  run: 'bg-sport-run/15 text-sport-run border-sport-run/30',
  ride: 'bg-sport-ride/15 text-sport-ride border-sport-ride/30',
  swim: 'bg-sport-swim/15 text-sport-swim border-sport-swim/30',
  hike: 'bg-sport-hike/15 text-sport-hike border-sport-hike/30',
  workout: 'bg-sport-workout/15 text-sport-workout border-sport-workout/30',
};

export const SPORT_LABEL_MAP: Record<SportType, string> = {
  run: 'Run',
  ride: 'Ride',
  swim: 'Swim',
  hike: 'Hike',
  workout: 'Workout',
};
```

---

## 2. Data Schema & Pure TypeScript Interfaces

```typescript
// types/fitness.ts

export type SportType = 'run' | 'ride' | 'swim' | 'hike' | 'workout';

export type PrivacySetting = 'public' | 'followers' | 'private';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  timestampOffsetSeconds: number;
}

export interface ElevationPoint {
  distanceMeters: number;
  elevationMeters: number;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  location: string;
  bio: string;
  avatarInitials: string;
  followingCount: number;
  followersCount: number;
  weeklyGoalMeters: number;
  weeklyGoalSport: SportType;
  createdAt: string;
}

export interface KudosRecord {
  userId: string;
  username: string;
  timestamp: string;
}

export interface ActivityComment {
  id: string;
  activityId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  title: string;
  description: string;
  sportType: SportType;
  startTime: string; // ISO 8601 string
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  calories: number;
  coordinates: GeoPoint[]; // Elevation profile is derived dynamically from coordinates
  kudos: KudosRecord[];
  comments: ActivityComment[];
  privacy: PrivacySetting;
  createdAt: string;
  updatedAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: 'distance' | 'elevation';
  sportTypes: SportType[];
  targetValue: number; // Meters for distance, meters climbed for elevation
  startDate: string;
  endDate: string;
  joined: boolean;
  participantCount: number;
  badgeCode: string;
}

export interface AthleteDirectoryEntry {
  fullName: string;
  username: string;
  avatarInitials: string;
  location: string;
}

export interface WeeklyAggregates {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalElevationGainMeters: number;
  totalActivitiesCount: number;
  targetDistanceMeters: number;
  progressPercentage: number; // Raw ratio capped at 100 for visual bars
  actualPercentage: number;   // Uncapped display percentage
}

export interface ActivityFilterCriteria {
  sportType: SportType | 'all';
  sortBy: 'latest' | 'distance' | 'duration' | 'kudos';
  dateRange: 'all' | 'this_week' | 'this_month';
  searchQuery: string;
}

export interface NewActivityInput {
  title: string;
  description: string;
  sportType: SportType;
  startTime: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  privacy: PrivacySetting;
  routePattern: 'loop' | 'out_and_back' | 'climb' | 'stationary';
}
```

---

## 3. Mathematical, Telemetry & Coordinate Engineering

### 3.1. Projection with Longitudinal Aspect Correction
Longitude distance diminishes with latitude. The projection calculates the midpoint latitude (`midLat`) and applies `Math.cos(midLat)` to prevent geographic stretch. Arrays are reduced in a single loop to prevent call-stack overflows.

```typescript
// utils/telemetryMath.ts
import type { GeoPoint, ElevationPoint, SportType } from '../types/fitness';

export interface SvgProjectionResult {
  pathD: string;
  startPoint: { x: number; y: number } | null;
  endPoint: { x: number; y: number } | null;
  points: { x: number; y: number }[];
}

export function projectCoordinates(
  coords: GeoPoint[],
  svgWidth: number,
  svgHeight: number,
  padding: number = 24
): SvgProjectionResult {
  if (!coords || coords.length === 0) {
    return { pathD: '', startPoint: null, endPoint: null, points: [] };
  }

  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  for (let i = 1; i < coords.length; i++) {
    const lat = coords[i].latitude;
    const lng = coords[i].longitude;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const cosMidLat = Math.max(0.1, Math.cos(midLat));

  const deltaLat = maxLat - minLat || 0.0001;
  const deltaLng = (maxLng - minLng) * cosMidLat || 0.0001;

  const drawableWidth = Math.max(10, svgWidth - padding * 2);
  const drawableHeight = Math.max(10, svgHeight - padding * 2);

  const scale = Math.min(drawableWidth / deltaLng, drawableHeight / deltaLat);

  const offsetX = padding + (drawableWidth - deltaLng * scale) / 2;
  const offsetY = padding + (drawableHeight - deltaLat * scale) / 2;

  const points = coords.map((c) => {
    const projectedLng = (c.longitude - minLng) * cosMidLat;
    const x = offsetX + projectedLng * scale;
    const y = svgHeight - (offsetY + (c.latitude - minLat) * scale);
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });

  const pathD = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return {
    pathD,
    startPoint: points[0],
    endPoint: points[points.length - 1],
    points,
  };
}
```

### 3.2. Haversine Distance, Dynamic Elevation Profile & Calories
```typescript
// utils/telemetryMath.ts (continued)

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function deriveElevationProfile(coords: GeoPoint[]): ElevationPoint[] {
  if (!coords || coords.length === 0) return [];
  const profile: ElevationPoint[] = [{ distanceMeters: 0, elevationMeters: coords[0].elevationMeters }];
  let accumulatedDistance = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    accumulatedDistance += haversineMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
    profile.push({
      distanceMeters: Math.round(accumulatedDistance),
      elevationMeters: Math.round(curr.elevationMeters),
    });
  }
  return profile;
}

export function calculateCalories(
  durationSeconds: number,
  sport: SportType,
  weightKg: number = 72
): number {
  if (durationSeconds <= 0) return 0;
  const MET_MAP: Record<SportType, number> = {
    run: 9.8,
    ride: 7.5,
    swim: 8.0,
    hike: 6.0,
    workout: 5.5,
  };
  const hours = durationSeconds / 3600;
  return Math.round(MET_MAP[sport] * weightKg * hours);
}
```

### 3.3. Deterministic Synthetic Route Engine (Mulberry32 PRNG)
Generates lightweight GPS routes (under 120 points) without static coordinate blobs or network fetches:

```typescript
// utils/routeGenerator.ts
import type { GeoPoint } from '../types/fitness';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticRoute(
  pattern: 'loop' | 'out_and_back' | 'climb' | 'stationary',
  distanceMeters: number,
  elevationGainMeters: number,
  seed: number = 42
): GeoPoint[] {
  if (pattern === 'stationary' || distanceMeters <= 0) return [];

  const prng = mulberry32(seed);
  const pointCount = Math.min(120, Math.max(30, Math.round(distanceMeters / 150)));
  const baseLat = 37.7749;
  const baseLng = -122.4194;
  const baseElevation = 25;
  const coords: GeoPoint[] = [];

  const baseRadLat = (baseLat * Math.PI) / 180;
  const cosBaseLat = Math.cos(baseRadLat);
  const linearDegSpan = (distanceMeters / 111000) * 0.7;

  let currentLat = baseLat;
  let currentLng = baseLng;
  let currentEle = baseElevation;

  for (let i = 0; i < pointCount; i++) {
    const progress = i / (pointCount - 1);

    if (pattern === 'loop') {
      const angle = progress * 2 * Math.PI;
      const radiusDeg = (distanceMeters / (2 * Math.PI)) / 111000;
      currentLat = baseLat + radiusDeg * Math.sin(angle) + (prng() - 0.5) * 0.0003;
      currentLng = baseLng + (radiusDeg * Math.cos(angle)) / cosBaseLat + (prng() - 0.5) * 0.0003;
      currentEle = baseElevation + Math.sin(progress * Math.PI) * elevationGainMeters + prng() * 2;
    } else if (pattern === 'out_and_back') {
      const normalizedProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
      currentLat = baseLat + normalizedProgress * linearDegSpan * 0.8 + (prng() - 0.5) * 0.0002;
      currentLng = baseLng + (normalizedProgress * linearDegSpan * 0.6) / cosBaseLat + (prng() - 0.5) * 0.0002;
      currentEle = baseElevation + normalizedProgress * elevationGainMeters + prng() * 2;
    } else {
      // climb
      currentLat = baseLat + progress * linearDegSpan * 0.85 + (prng() - 0.5) * 0.0002;
      currentLng = baseLng + (progress * linearDegSpan * 0.5) / cosBaseLat + (prng() - 0.5) * 0.0002;
      currentEle = baseElevation + progress * elevationGainMeters + prng() * 1.5;
    }

    coords.push({
      latitude: Number(currentLat.toFixed(6)),
      longitude: Number(currentLng.toFixed(6)),
      elevationMeters: Math.max(0, Math.round(currentEle)),
      timestampOffsetSeconds: Math.round(progress * 3600),
    });
  }

  return coords;
}
```

### 3.4. Formatters with Boundary Guards
```typescript
// utils/formatters.ts
import type { SportType } from '../types/fitness';

export function formatDistance(meters: number, sport: SportType): string {
  if (meters <= 0) return sport === 'swim' ? '0 m' : '0.00 km';
  if (sport === 'swim') {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function calculatePaceOrSpeed(
  durationSeconds: number,
  distanceMeters: number,
  sport: SportType
): { value: string; unit: string } {
  if (durationSeconds <= 0 || distanceMeters <= 0) {
    if (sport === 'ride') return { value: '0.0', unit: 'km/h' };
    if (sport === 'swim') return { value: '0:00', unit: '/100m' };
    if (sport === 'workout') return { value: '--', unit: 'pace' };
    return { value: '0:00', unit: '/km' };
  }

  if (sport === 'ride') {
    const kmh = (distanceMeters / 1000) / (durationSeconds / 3600);
    return { value: kmh.toFixed(1), unit: 'km/h' };
  }

  if (sport === 'swim') {
    const hundreds = distanceMeters / 100;
    const paceSeconds = Math.round(durationSeconds / hundreds);
    const m = Math.floor(paceSeconds / 60);
    const s = paceSeconds % 60;
    return { value: `${m}:${s.toString().padStart(2, '0')}`, unit: '/100m' };
  }

  if (sport === 'workout') {
    return { value: 'Active', unit: 'status' };
  }

  // Run / Hike (min/km)
  const km = distanceMeters / 1000;
  const roundedPaceTotalSeconds = Math.round(durationSeconds / km);
  const paceMinutes = Math.floor(roundedPaceTotalSeconds / 60);
  const paceSeconds = roundedPaceTotalSeconds % 60;
  return {
    value: `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`,
    unit: '/km',
  };
}

export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffSeconds = Math.round((then - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffSeconds) < 60) return 'just now';
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
```

---

## 4. Single Shared Reactive Storage Engine

To prevent infinite re-renders and lost updates across tabs or components:
1. `useSyncExternalStore` receives a cached snapshot reference keyed by raw local storage strings.
2. Updates use atomic updater functions (`(prev) => next`) that re-read localStorage immediately before mutating.
3. Seeding occurs during store module evaluation guarded by a dedicated `SEEDED_KEY`.

```typescript
// utils/seedAthletes.ts
import type { AthleteDirectoryEntry } from '../types/fitness';

export const CURRENT_USER_ID = 'athlete-me-01';

export const ATHLETE_DIRECTORY: Record<string, AthleteDirectoryEntry> = {
  [CURRENT_USER_ID]: {
    fullName: 'Alex Reynolds',
    username: 'marathoner_alex',
    avatarInitials: 'AR',
    location: 'San Francisco, CA',
  },
  'user-02': {
    fullName: 'Elena Rostova',
    username: 'elena_rides',
    avatarInitials: 'ER',
    location: 'Sausalito, CA',
  },
  'user-03': {
    fullName: 'Marcus Vance',
    username: 'vance_swims',
    avatarInitials: 'MV',
    location: 'Berkeley, CA',
  },
};

export function getAthlete(userId: string): AthleteDirectoryEntry {
  return (
    ATHLETE_DIRECTORY[userId] ?? {
      fullName: 'Community Athlete',
      username: 'athlete',
      avatarInitials: 'CA',
      location: 'Global',
    }
  );
}

export const CURRENT_USER_ID = 'athlete-me-01';

// Snapshot Caches to guarantee reference equality for useSyncExternalStore
let rawActivitiesString: string | null = null;
let parsedActivitiesCache: Activity[] = [];

let rawUserString: string | null = null;
let parsedUserCache: UserProfile = {
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

let rawChallengesString: string | null = null;
let parsedChallengesCache: Challenge[] = [];

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // When event.key is null, localStorage.clear() occurred
    if (event.key === null || event.key.startsWith(STORAGE_KEY_PREFIX)) {
      notify();
    }
  });

  window.addEventListener(SYNC_EVENT, () => {
    notify();
  });
}

function broadcastLocalChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
  notify();
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getActivitiesSnapshot(): Activity[] {
  if (typeof window === 'undefined') return parsedActivitiesCache;
  const currentRaw = localStorage.getItem(ACTIVITIES_KEY);
  if (currentRaw !== rawActivitiesString) {
    rawActivitiesString = currentRaw;
    parsedActivitiesCache = safeParse<Activity[]>(currentRaw, []);
  }
  return parsedActivitiesCache;
}

export function getUserSnapshot(): UserProfile {
  if (typeof window === 'undefined') return parsedUserCache;
  const currentRaw = localStorage.getItem(USER_KEY);
  if (currentRaw !== rawUserString) {
    rawUserString = currentRaw;
    parsedUserCache = safeParse<UserProfile>(currentRaw, parsedUserCache);
  }
  return parsedUserCache;
}

export function getChallengesSnapshot(): Challenge[] {
  if (typeof window === 'undefined') return parsedChallengesCache;
  const currentRaw = localStorage.getItem(CHALLENGES_KEY);
  if (currentRaw !== rawChallengesString) {
    rawChallengesString = currentRaw;
    parsedChallengesCache = safeParse<Challenge[]>(currentRaw, []);
  }
  return parsedChallengesCache;
}

// Atomic mutating functions with isolated parsing and storage quota event dispatch
export function updateActivities(updater: (prev: Activity[]) => Activity[]): boolean {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    const prev = safeParse<Activity[]>(raw, []);
    const next = updater(prev);
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(next));
    broadcastLocalChange();
    return true;
  } catch (error) {
    console.error('Storage write error (activities):', error);
    window.dispatchEvent(new CustomEvent('fitness_storage_error', { detail: 'Storage write failed. Quota may be exceeded.' }));
    return false;
  }
}

export function updateUser(updater: (prev: UserProfile) => UserProfile): boolean {
  try {
    const raw = localStorage.getItem(USER_KEY);
    const prev = safeParse<UserProfile>(raw, parsedUserCache);
    const next = updater(prev);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    broadcastLocalChange();
    return true;
  } catch (error) {
    console.error('Storage write error (user):', error);
    window.dispatchEvent(new CustomEvent('fitness_storage_error', { detail: 'Storage write failed.' }));
    return false;
  }
}

export function updateChallenges(updater: (prev: Challenge[]) => Challenge[]): boolean {
  try {
    const raw = localStorage.getItem(CHALLENGES_KEY);
    const prev = safeParse<Challenge[]>(raw, []);
    const next = updater(prev);
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(next));
    broadcastLocalChange();
    return true;
  } catch (error) {
    console.error('Storage write error (challenges):', error);
    window.dispatchEvent(new CustomEvent('fitness_storage_error', { detail: 'Storage write failed.' }));
    return false;
  }
}

export function resetDemoData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SEEDED_KEY);
  localStorage.removeItem(ACTIVITIES_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CHALLENGES_KEY);
  initializeSeedData();
  broadcastLocalChange();
}

// Fallback UUID Generator safe for plain HTTP/LAN testing
export function generateSafeId(prefix: string = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `${prefix}-${crypto.randomUUID()}`;
    } catch {
      // Fall through to fallback
    }
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Initialization Seeder with dynamic timestamps relative to Date.now()
export function initializeSeedData(): void {
  if (typeof window === 'undefined') return;
  const isSeeded = localStorage.getItem(SEEDED_KEY);
  if (isSeeded === 'true') return;

  const now = Date.now();
  const ONE_HOUR = 3600 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  const seedActivities: Activity[] = [
    {
      id: generateSafeId('act'),
      userId: CURRENT_USER_ID,
      title: 'Sunrise Ridge Trail Run',
      description: 'Cool crisp morning tempo on the western ridge trail. Felt strong on the inclines.',
      sportType: 'run',
      startTime: new Date(now - 3 * ONE_HOUR).toISOString(),
      durationSeconds: 3120, // 52 mins
      distanceMeters: 10450, // 10.45 km
      elevationGainMeters: 285,
      calories: calculateCalories(3120, 'run'),
      coordinates: generateSyntheticRoute('climb', 10450, 285, 101),
      kudos: [
        { userId: 'user-02', username: 'Elena Rostova', timestamp: new Date(now - 2 * ONE_HOUR).toISOString() },
        { userId: 'user-03', username: 'Marcus Vance', timestamp: new Date(now - 1 * ONE_HOUR).toISOString() },
      ],
      comments: [
        {
          id: generateSafeId('cmt'),
          activityId: 'dummy',
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
      id: generateSafeId('act'),
      userId: 'user-02',
      title: 'Marin Headlands Coastal Loop',
      description: 'Headwind on the bridge return, but spectacular visibility over the bay.',
      sportType: 'ride',
      startTime: new Date(now - 18 * ONE_HOUR).toISOString(),
      durationSeconds: 6840, // 1h 54m
      distanceMeters: 52300, // 52.3 km
      elevationGainMeters: 640,
      calories: calculateCalories(6840, 'ride'),
      coordinates: generateSyntheticRoute('loop', 52300, 640, 202),
      kudos: [
        { userId: CURRENT_USER_ID, username: 'Alex Reynolds', timestamp: new Date(now - 16 * ONE_HOUR).toISOString() },
      ],
      comments: [],
      privacy: 'public',
      createdAt: new Date(now - 18 * ONE_HOUR).toISOString(),
      updatedAt: new Date(now - 18 * ONE_HOUR).toISOString(),
    },
    {
      id: generateSafeId('act'),
      userId: 'user-03',
      title: 'Aquatic Park Open Water Laps',
      description: 'Chilly 14C water. Sighting practice between buoys.',
      sportType: 'swim',
      startTime: new Date(now - 1 * ONE_DAY).toISOString(),
      durationSeconds: 2280, // 38 mins
      distanceMeters: 1800, // 1800 m
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
      id: generateSafeId('act'),
      userId: CURRENT_USER_ID,
      title: 'Mount Tamalpais Summit Scramble',
      description: 'Steep grades, rocky terrain. Heavy pack day.',
      sportType: 'hike',
      startTime: new Date(now - 2 * ONE_DAY).toISOString(),
      durationSeconds: 10800, // 3h 0m
      distanceMeters: 14200, // 14.2 km
      elevationGainMeters: 780,
      calories: calculateCalories(10800, 'hike'),
      coordinates: generateSyntheticRoute('climb', 14200, 780, 404),
      kudos: [
        { userId: 'user-02', username: 'Elena Rostova', timestamp: new Date(now - 2 * ONE_DAY + ONE_HOUR).toISOString() },
      ],
      comments: [],
      privacy: 'followers',
      createdAt: new Date(now - 2 * ONE_DAY).toISOString(),
      updatedAt: new Date(now - 2 * ONE_DAY).toISOString(),
    },
    {
      id: generateSafeId('act'),
      userId: CURRENT_USER_ID,
      title: 'Core & Kettlebell Conditioning',
      description: '5 rounds: swings, Turkish get-ups, goblet squats, and planks.',
      sportType: 'workout',
      startTime: new Date(now - 3 * ONE_DAY).toISOString(),
      durationSeconds: 2700, // 45m
      distanceMeters: 0,
      elevationGainMeters: 0,
      calories: calculateCalories(2700, 'workout'),
      coordinates: [],
      kudos: [],
      comments: [],
      privacy: 'private',
      createdAt: new Date(now - 3 * ONE_DAY).toISOString(),
      updatedAt: new Date(now - 3 * ONE_DAY).toISOString(),
    }
  ];

  // Fix activity id reference in comment
  seedActivities[0].comments[0].activityId = seedActivities[0].id;

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
    }
  ];

  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(seedActivities));
    localStorage.setItem(USER_KEY, JSON.stringify(parsedUserCache));
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(seedChallenges));
    localStorage.setItem(SEEDED_KEY, 'true');
  } catch (error) {
    console.error('Storage seeding error:', error);
  }
}

// Execute seed eagerly on initial module evaluation
if (typeof window !== 'undefined') {
  initializeSeedData();
}
```

---

## 5. UI Primitives, SVG Charts & Visual Components

### 5.1. Route Map SVG Canvas with Start/Finish Callouts
Uses `useId()` stripped of invalid characters to generate SVG gradient identifiers that never collide between cards:

```typescript
// components/charts/RouteMapCanvas.tsx
import { useId } from 'react';
import type { GeoPoint } from '../../types/fitness';
import { projectCoordinates } from '../../utils/telemetryMath';

interface RouteMapCanvasProps {
  coordinates: GeoPoint[];
  sportType: string;
  className?: string;
  onExpand?: () => void;
}

export function RouteMapCanvas({
  coordinates,
  className = '',
  onExpand,
}: RouteMapCanvasProps) {
  const rawId = useId();
  const gradientId = `route-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;

  if (!coordinates || coordinates.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-surface-900 border border-surface-700/50 rounded-lg text-ink-tertiary text-xs aspect-[480/220] ${className}`}>
        No GPS Track Recorded
      </div>
    );
  }

  const { pathD, startPoint, endPoint } = projectCoordinates(coordinates, 480, 220, 24);

  return (
    <button
      type="button"
      onClick={onExpand}
      disabled={!onExpand}
      aria-label="Enlarge GPS Route"
      className={`relative w-full aspect-[480/220] block overflow-hidden bg-surface-900/90 rounded-lg border border-surface-700/60 p-0 text-left select-none ${
        onExpand ? 'cursor-pointer hover:border-surface-600 transition-colors focus:outline-hidden focus:ring-2 focus:ring-strava-orange/50' : 'cursor-default'
      } ${className}`}
    >
      <svg
        viewBox="0 0 480 220"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full min-w-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FC4C02" />
            <stop offset="100%" stopColor="#FF8400" />
          </linearGradient>
        </defs>

        <path
          d={pathD}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {startPoint && (
          <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r="4.5"
            className="fill-emerald-500 stroke-white stroke-2"
          />
        )}

        {endPoint && (
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r="4.5"
            className="fill-rose-500 stroke-white stroke-2"
          />
        )}
      </svg>
    </button>
  );
}
```

### 5.2. Elevation Profile Chart with HTML Overlays
Text within SVGs becomes unreadable on scaled viewports (e.g. 360px). Elevation callouts are rendered as HTML overlays positioned over the chart:

```typescript
// components/charts/ElevationChart.tsx
import { useId } from 'react';
import type { ElevationPoint } from '../../types/fitness';

interface ElevationChartProps {
  profile: ElevationPoint[];
  className?: string;
}

export function ElevationChart({ profile, className = '' }: ElevationChartProps) {
  const rawId = useId();
  const fillGradId = `ele-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;

  if (!profile || profile.length < 2) return null;

  let minEle = profile[0].elevationMeters;
  let maxEle = profile[0].elevationMeters;
  let maxDist = profile[profile.length - 1].distanceMeters || 1;

  for (let i = 1; i < profile.length; i++) {
    const ele = profile[i].elevationMeters;
    if (ele < minEle) minEle = ele;
    if (ele > maxEle) maxEle = ele;
  }

  const deltaEle = maxEle - minEle || 10;
  const svgW = 400;
  const svgH = 100;
  const pad = 8;
  const chartW = svgW - pad * 2;
  const chartH = svgH - pad * 2;

  const points = profile.map((p) => {
    const x = pad + (p.distanceMeters / maxDist) * chartW;
    const y = svgH - pad - ((p.elevationMeters - minEle) / deltaEle) * chartH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const strokeSegments: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cX = Number(((curr.x + next.x) / 2).toFixed(1));
    strokeSegments.push(`C ${cX} ${curr.y}, ${cX} ${next.y}, ${next.x} ${next.y}`);
  }

  const strokePath = strokeSegments.join(' ');
  const lastX = points[points.length - 1].x;
  const firstX = points[0].x;
  const baselineY = svgH - pad;
  const fillPath = `${strokePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  return (
    <div className={`relative w-full bg-surface-900/60 rounded-md border border-surface-700/40 p-2 ${className}`}>
      {/* HTML Elevation Callouts */}
      <div className="flex justify-between items-center text-[10px] text-ink-tertiary mb-1 font-mono">
        <span>Min: {minEle}m</span>
        <span>Elevation Profile</span>
        <span>Max: {maxEle}m</span>
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        height="64"
        preserveAspectRatio="none"
        className="block w-full min-w-0"
      >
        <defs>
          <linearGradient id={fillGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FC4C02" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FC4C02" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <path d={fillPath} fill={`url(#${fillGradId})`} />
        <path d={strokePath} fill="none" stroke="#FC4C02" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
```

### 5.3. Accessible Modal Dialog Primitive
Leverages native HTML5 `<dialog>` and `.showModal()` for focus trapping, backdrop handling, and Escape-key closure:

```typescript
// components/ui/Modal.tsx
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        document.documentElement.classList.add('overflow-hidden');
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.documentElement.classList.remove('overflow-hidden');
    }

    return () => {
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    // Backdrop click detection: target equals dialog container itself
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleDialogClick}
      className="backdrop:bg-black/75 backdrop:backdrop-blur-xs bg-surface-800 text-ink-primary border border-surface-600 rounded-xl p-0 shadow-2xl max-w-lg w-[calc(100%-2rem)] max-h-[90dvh] overflow-hidden m-auto"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600 min-w-0">
        <h2 className="text-base font-semibold truncate text-ink-primary min-w-0">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="min-h-11 min-w-11 -mr-2 flex items-center justify-center text-ink-tertiary hover:text-ink-primary transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 overflow-y-auto max-h-[calc(90dvh-4.5rem)]">{children}</div>
    </dialog>
  );
}
```

---

## 6. Layout Blueprint & Viewport Adaptation

```
Mobile (< 768px):
+---------------------------------------------------+
| Header: Logo (Strava Orange) | Search Icon        |
+---------------------------------------------------+
| Sport Filter Scroll-Tabs (overflow-x-auto)        |
+---------------------------------------------------+
| Activity Feed Column                              |
| - Activity Card (min-w-0)                         |
|   * Athlete Info & Sport Badge                    |
|   * Title (line-clamp-2) & Description            |
|   * Metrics Grid (2 cols at 360px, 3 cols at 390+) |
|   * SVG Route Map (tap to expand)                 |
|   * Kudos & Comment Buttons (44px touch targets)  |
+---------------------------------------------------+
| Fixed Bottom Nav: [Feed] [Weekly] [+ Log] [Clubs] |
+---------------------------------------------------+

Tablet (768px - 1279px, md):
+---------------------------------------------------+
| Header: Logo | Search Bar | "+ Log Activity" Button|
+---------------------------------------------------+
| Grid (2 Columns):                                 |
| Left (Feed, 62%):          | Right (Sidebar, 38%):|
| - Filter Tabs              | - Athlete Profile    |
| - Activity Cards           | - Weekly Run Goal    |
|                            | - Active Challenges  |
+---------------------------------------------------+

Desktop (1280px+, xl):
+-------------------------------------------------------------------------+
| Header: Logo | Search Input | "+ Log Activity" Button | Athlete Badge   |
+-------------------------------------------------------------------------+
| Grid (3 Columns, max-w-7xl mx-auto):                                   |
| Left (280px):        | Center (Feed, min-w-0):  | Right (300px):        |
| - Athlete Card       | - Filter Bar (All, Run,  | - Active Challenges   |
| - Weekly Goal Dial   |   Ride, Swim, Hike, Gym) | - Join Challenge CTA  |
| - Reset Demo Button  | - Activity Card Stream   | - Club Directory Card |
+-------------------------------------------------------------------------+
```

### 6.1. Mobile Metric Grid Specification (360px Safe)
On 360px viewports, 5 metrics in a 2-column grid leave an orphan. The 5th metric spans 2 columns:

```typescript
// components/feed/ActivityStatsGrid.tsx
import type { Activity } from '../../types/fitness';
import { formatDistance, formatDuration, calculatePaceOrSpeed } from '../../utils/formatters';

interface ActivityStatsGridProps {
  activity: Activity;
}

export function ActivityStatsGrid({ activity }: ActivityStatsGridProps) {
  const isWorkout = activity.sportType === 'workout';
  const pace = calculatePaceOrSpeed(activity.durationSeconds, activity.distanceMeters, activity.sportType);
  const dist = formatDistance(activity.distanceMeters, activity.sportType);
  const time = formatDuration(activity.durationSeconds);

  if (isWorkout) {
    return (
      <div className="grid grid-cols-2 gap-2 py-3 border-y border-surface-700/60 my-3">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Active Duration</span>
          <span className="text-base font-bold text-ink-primary truncate">{time}</span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Calories Burned</span>
          <span className="text-base font-bold text-ink-primary truncate">{activity.calories} kcal</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 py-3 border-y border-surface-700/60 my-3">
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Distance</span>
        <span className="text-base font-bold text-ink-primary truncate">{dist}</span>
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Time</span>
        <span className="text-base font-bold text-ink-primary truncate">{time}</span>
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">
          {activity.sportType === 'ride' ? 'Avg Speed' : 'Pace'}
        </span>
        <span className="text-base font-bold text-ink-primary truncate">
          {pace.value} <span className="text-xs font-normal text-ink-tertiary">{pace.unit}</span>
        </span>
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Elev Gain</span>
        <span className="text-base font-bold text-ink-primary truncate">{activity.elevationGainMeters} m</span>
      </div>

      {/* 5th metric spans 2 cols on mobile 360px, normal single column on 390px+ */}
      <div className="flex flex-col min-w-0 col-span-2 xs:col-span-1">
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Calories</span>
        <span className="text-base font-bold text-ink-primary truncate">{activity.calories} kcal</span>
      </div>
    </div>
  );
}
```

---

## 7. Domain Hooks & State Implementations

### 7.1. Activity Feed Hook (`useActivities.ts`)
```typescript
// utils/dateHelpers.ts
export function getStartOfWeek(date: Date = new Date()): number {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getStartOfMonth(date: Date = new Date()): number {
  const d = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  return d.getTime();
}
// hooks/useActivities.ts
import { useSyncExternalStore, useMemo } from 'react';
import type { Activity, ActivityFilterCriteria, NewActivityInput } from '../types/fitness';
import {
  getActivitiesSnapshot,
  subscribeToStore,
  updateActivities,
  generateSafeId,
  CURRENT_USER_ID,
} from '../services/storageStore';
import { generateSyntheticRoute } from '../utils/routeGenerator';
import { calculateCalories } from '../utils/telemetryMath';
import { getStartOfWeek, getStartOfMonth } from '../utils/dateHelpers';

export function useActivities(filters: ActivityFilterCriteria) {
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);

  const filteredActivities = useMemo(() => {
    let result = activities.filter((a) => {
      // Privacy Guard: view all personal posts or public community posts
      return a.userId === CURRENT_USER_ID || a.privacy === 'public';
    });

    // Sport Filter
    if (filters.sportType !== 'all') {
      result = result.filter((a) => a.sportType === filters.sportType);
    }

    // Search Query Filter
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      );
    }

    // Shared Calendar Date Filter
    if (filters.dateRange === 'this_week') {
      const startOfWeek = getStartOfWeek();
      result = result.filter((a) => new Date(a.startTime).getTime() >= startOfWeek);
    } else if (filters.dateRange === 'this_month') {
      const startOfMonth = getStartOfMonth();
      result = result.filter((a) => new Date(a.startTime).getTime() >= startOfMonth);
    }

    // Sort with stable tiebreak on startTime descending
    result.sort((a, b) => {
      if (filters.sortBy === 'distance') {
        const diff = b.distanceMeters - a.distanceMeters;
        if (diff !== 0) return diff;
      } else if (filters.sortBy === 'duration') {
        const diff = b.durationSeconds - a.durationSeconds;
        if (diff !== 0) return diff;
      } else if (filters.sortBy === 'kudos') {
        const diff = b.kudos.length - a.kudos.length;
        if (diff !== 0) return diff;
      }
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    return result;
  }, [activities, filters]);

  const addActivity = (input: NewActivityInput) => {
    const coords = generateSyntheticRoute(
      input.routePattern,
      input.distanceMeters,
      input.elevationGainMeters,
      Date.now()
    );

    const calories = calculateCalories(input.durationSeconds, input.sportType);

    const newActivity: Activity = {
      id: generateSafeId('act'),
      userId: CURRENT_USER_ID,
      title: input.title.trim(),
      description: input.description.trim(),
      sportType: input.sportType,
      startTime: input.startTime || new Date().toISOString(),
      durationSeconds: input.durationSeconds,
      distanceMeters: input.sportType === 'workout' ? 0 : input.distanceMeters,
      elevationGainMeters: input.sportType === 'workout' ? 0 : input.elevationGainMeters,
      calories,
      coordinates: coords,
      kudos: [],
      comments: [],
      privacy: input.privacy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateActivities((prev) => [newActivity, ...prev]);
  };

  const deleteActivity = (activityId: string) => {
    updateActivities((prev) =>
      prev.filter((a) => {
        // Ownership guard: only allow deleting owned posts
        if (a.id === activityId) {
          return a.userId !== CURRENT_USER_ID;
        }
        return true;
      })
    );
  };

  return {
    activities: filteredActivities,
    totalCount: activities.length,
    addActivity,
    deleteActivity,
  };
}
```

### 7.2. Social Kudos & Comment Hooks
```typescript
// hooks/useSocial.ts
import { updateActivities, CURRENT_USER_ID, getUserSnapshot, generateSafeId } from '../services/storageStore';

export function toggleKudos(activityId: string): void {
  const currentUser = getUserSnapshot();

  updateActivities((prev) =>
    prev.map((activity) => {
      if (activity.id !== activityId) return activity;

      const hasGivenKudos = activity.kudos.some((k) => k.userId === CURRENT_USER_ID);
      const nextKudos = hasGivenKudos
        ? activity.kudos.filter((k) => k.userId !== CURRENT_USER_ID)
        : [
            ...activity.kudos,
            {
              userId: CURRENT_USER_ID,
              username: currentUser.username,
              timestamp: new Date().toISOString(),
            },
          ];

      return { ...activity, kudos: nextKudos };
    })
  );
}

export function addComment(activityId: string, content: string): void {
  const trimmed = content.trim();
  if (!trimmed) return;

  const currentUser = getUserSnapshot();

  updateActivities((prev) =>
    prev.map((activity) => {
      if (activity.id !== activityId) return activity;

      const newComment = {
        id: generateSafeId('cmt'),
        activityId,
        userId: CURRENT_USER_ID,
        userName: currentUser.fullName,
        content: trimmed.substring(0, 300),
        createdAt: new Date().toISOString(),
      };

      return { ...activity, comments: [...activity.comments, newComment] };
    })
  );
}

export function deleteComment(activityId: string, commentId: string): void {
  updateActivities((prev) =>
    prev.map((activity) => {
      if (activity.id !== activityId) return activity;
      return {
        ...activity,
        comments: activity.comments.filter((c) => {
          // Ownership guard: only allow deleting owned comments
          if (c.id === commentId) {
            return c.userId !== CURRENT_USER_ID;
          }
          return true;
        }),
      };
    })
  );
}
```

### 7.3. Weekly Aggregation & Goals Hook (`useWeeklyStats.ts`)
Calculates totals from Monday 00:00:00 local time:

```typescript
// hooks/useWeeklyStats.ts
import { useSyncExternalStore, useMemo } from 'react';
import type { WeeklyAggregates } from '../types/fitness';
import { getActivitiesSnapshot, getUserSnapshot, subscribeToStore, CURRENT_USER_ID } from '../services/storageStore';
import { getStartOfWeek } from '../utils/dateHelpers';

export function useWeeklyStats(): WeeklyAggregates {
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);
  const user = useSyncExternalStore(subscribeToStore, getUserSnapshot);

  return useMemo(() => {
    const startOfWeekTime = getStartOfWeek();

    let totalDist = 0;
    let totalSecs = 0;
    let totalElev = 0;
    let count = 0;

    for (const act of activities) {
      if (act.userId !== CURRENT_USER_ID) continue;
      const actTime = new Date(act.startTime).getTime();
      if (actTime >= startOfWeekTime) {
        if (act.sportType === user.weeklyGoalSport) {
          totalDist += act.distanceMeters;
        }
        totalSecs += act.durationSeconds;
        totalElev += act.elevationGainMeters;
        count++;
      }
    }

    const target = user.weeklyGoalMeters || 50000;
    const ratio = target > 0 ? (totalDist / target) * 100 : 0;

    return {
      totalDistanceMeters: totalDist,
      totalDurationSeconds: totalSecs,
      totalElevationGainMeters: totalElev,
      totalActivitiesCount: count,
      targetDistanceMeters: target,
      progressPercentage: Math.min(100, Math.round(ratio)),
      actualPercentage: Math.round(ratio),
    };
  }, [activities, user]);
}

// hooks/useChallenges.ts
import { useSyncExternalStore, useMemo } from 'react';
import type { Challenge } from '../types/fitness';
import { getChallengesSnapshot, getActivitiesSnapshot, subscribeToStore, updateChallenges, CURRENT_USER_ID } from '../services/storageStore';

export interface ChallengeWithProgress extends Challenge {
  currentProgress: number;
  progressPercentage: number;
}

export function useChallenges() {
  const challenges = useSyncExternalStore(subscribeToStore, getChallengesSnapshot);
  const activities = useSyncExternalStore(subscribeToStore, getActivitiesSnapshot);

  const challengesWithProgress: ChallengeWithProgress[] = useMemo(() => {
    return challenges.map((ch) => {
      const startTime = new Date(ch.startDate).getTime();
      const endTime = new Date(ch.endDate).getTime();

      let currentProgress = 0;
      for (const act of activities) {
        if (act.userId !== CURRENT_USER_ID) continue;
        const actTime = new Date(act.startTime).getTime();
        if (actTime >= startTime && actTime <= endTime && ch.sportTypes.includes(act.sportType)) {
          currentProgress += ch.metric === 'distance' ? act.distanceMeters : act.elevationGainMeters;
        }
      }

      const ratio = ch.targetValue > 0 ? (currentProgress / ch.targetValue) * 100 : 0;
      return {
        ...ch,
        currentProgress,
        progressPercentage: Math.min(100, Math.round(ratio)),
      };
    });
  }, [challenges, activities]);

  const toggleJoin = (challengeId: string) => {
    updateChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId) return ch;
        const joined = !ch.joined;
        return {
          ...ch,
          joined,
          participantCount: joined ? ch.participantCount + 1 : Math.max(0, ch.participantCount - 1),
        };
      })
    );
  };

  return { challenges: challengesWithProgress, toggleJoin };
}
```

---

## 8. Five-Phase Sequential Execution Queue

### Phase 0: Project Scaffolding, Cleanup & Configuration Gate
* [ ] Scaffold cleanly: create temp app `npm create vite@latest temp-scaffold -- --template react-ts`, move files into root, and remove `temp-scaffold`.
* [ ] Delete Vite boilerplate files: remove `src/App.css`, wipe `src/assets/`, remove `import './App.css'` from `src/App.tsx`.
* [ ] Install Tailwind CSS v4 and its Vite plugin: `npm i tailwindcss @tailwindcss/vite`.
* [ ] Configure `vite.config.ts` with `@tailwindcss/vite` plugin.
* [ ] Configure `index.html` with `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`.
* [ ] Replace `src/index.css` completely with `@import "tailwindcss";`, `@theme` tokens, and base dark layout layers:
  ```css
  @import "tailwindcss";

  @theme {
    --color-strava-orange: #FC4C02;
    --color-strava-orange-hover: #E34402;
    --color-surface-900: #121214;
    --color-surface-800: #1A1A1E;
    --color-surface-700: #24242A;
    --color-surface-600: #2E2E36;
    --color-ink-primary: #F4F4F6;
    --color-ink-secondary: #A1A1AA;
    --color-ink-tertiary: #71717A;
    --color-sport-run: #FC4C02;
    --color-sport-ride: #00A3FF;
    --color-sport-swim: #00E5FF;
    --color-sport-hike: #10B981;
    --color-sport-workout: #A855F7;
    --breakpoint-xs: 390px;
  }

  @layer base {
    html {
      color-scheme: dark;
    }
    body {
      background-color: var(--color-surface-900);
      color: var(--color-ink-primary);
      min-height: 100dvh;
    }
  }
  ```
* [ ] Gate Verification: `npm run lint && tsc -b && vite build`.

### Phase 1: Pure Types, Math, Route Generator & Shared Storage Engine
* [ ] Create pure interfaces in `src/types/fitness.ts` (all interfaces in Section 2).
* [ ] Implement athlete lookup directory in `src/utils/seedAthletes.ts` providing author names and initials for all posts.
* [ ] Implement calendar date boundaries `getStartOfWeek` and `getStartOfMonth` in `src/utils/dateHelpers.ts`.
* [ ] Implement projection math with `cos(midLat)` scaling and single-pass reductions in `src/utils/telemetryMath.ts`.
* [ ] Implement `deriveElevationProfile`, `haversineMeters`, and `calculateCalories` in `src/utils/telemetryMath.ts`.
* [ ] Implement Mulberry32 PRNG synthetic route generator in `src/utils/routeGenerator.ts` without unused variables and with distance-scaled coordinates.
* [ ] Implement formatters (`formatDistance`, `formatDuration`, `calculatePaceOrSpeed`, `formatRelativeTime`) in `src/utils/formatters.ts`.
* [ ] Implement single shared storage store in `src/services/storageStore.ts` with isolated JSON parsing, `resetDemoData()` action, and storage quota event dispatch.
* [ ] Gate Verification: `npm run lint && tsc -b && vite build`.

### Phase 2: Design Tokens & Atomic UI Primitives
* [ ] Create exhaustive static sport style dictionaries in `src/utils/sportMaps.ts` (`SPORT_COLOR_MAP`, `SPORT_BG_MAP`, `SPORT_LABEL_MAP`).
* [ ] Build accessible button primitive `src/components/ui/Button.tsx` (primary orange, secondary surface, ghost; guaranteed `min-h-11 min-w-11` touch targets; no `forwardRef`).
* [ ] Build metric display primitive `src/components/ui/MetricPill.tsx`.
* [ ] Build initials-based avatar primitive `src/components/ui/Avatar.tsx` (eliminates broken offline remote URLs).
* [ ] Build `src/components/ui/Badge.tsx` and custom SVGs in `src/components/icons/SportIcons.tsx` (Run, Ride, Swim, Hike, Workout).
* [ ] Build form primitives `src/components/ui/Input.tsx` and `src/components/ui/Select.tsx` with `text-base` (preventing iOS zoom) and accessible labels.
* [ ] Build HTML5 `<dialog>` component in `src/components/ui/Modal.tsx`.
* [ ] Gate Verification: `tsc -b && vite build`.

### Phase 3: Presentational Feature Components & Visualizations
* [ ] Build SVG route visualizer `src/components/charts/RouteMapCanvas.tsx` with `useId()` gradient sanitization and start/end indicators.
* [ ] Build elevation profile chart `src/components/charts/ElevationChart.tsx` with external HTML elevation labels.
* [ ] Build mobile-safe metric grid `src/components/feed/ActivityStatsGrid.tsx` with 2-column mobile orphan collapse.
* [ ] Build header and social interaction bar `src/components/feed/ActivityHeader.tsx` and `src/components/feed/ActivitySocialBar.tsx`.
* [ ] Build presentational comment thread and composer `src/components/feed/CommentThread.tsx`.
* [ ] Build `src/components/feed/ActivityCard.tsx` encapsulating the subcomponents.
* [ ] Build `src/components/sidebar/AthleteProfileCard.tsx`, `WeeklyGoalProgress.tsx`, and `ChallengeCard.tsx`.
* [ ] Gate Verification: `tsc -b && vite build`.

### Phase 4: Domain Hooks, Reactive State & Form Modal
* [ ] Implement `src/hooks/useActivities.ts` supporting privacy guards, ownership checks, shared calendar date filters, and stable sort tiebreakers.
* [ ] Implement `src/hooks/useSocial.ts` (`toggleKudos`, `addComment`, `deleteComment`) with ownership verification.
* [ ] Implement `src/hooks/useWeeklyStats.ts` with shared `getStartOfWeek` helper.
* [ ] Implement `src/hooks/useChallenges.ts` supporting dynamic progress calculation across elevation and distance metrics.
* [ ] Build manual entry modal `src/components/forms/ManualActivityModal.tsx`:
  * Title and description fields with character caps.
  * Datetime input converted to ISO string.
  * Sport type and privacy selectors.
  * Duration validation: total duration > 0, minutes <= 59, seconds <= 59.
  * Distance validation: distance > 0 unless sport is `workout` or pattern is `stationary`.
  * Unit toggle for swim (meters) vs ride/run/hike (kilometers).
  * Elevation validation: non-negative integer.
  * Route pattern selector (Loop, Out & Back, Climb, Stationary).
* [ ] Gate Verification: `npm run lint && tsc -b && vite build`.

### Phase 5: Shell Assembly, Responsive Layout & Build Verification
* [ ] Build global top header `src/components/layout/Header.tsx` (collapsible search at `< md`, brand icon, "+ Log Activity" action).
* [ ] Build fixed bottom navigation `src/components/layout/BottomNav.tsx` for mobile viewports (`< 768px`) with safe-area insets.
* [ ] Build shell layout wrapper ensuring `pb-[calc(4rem+env(safe-area-inset-bottom))]` on viewports `< md` to prevent bottom navigation occlusion.
* [ ] Build filter bar `src/components/feed/FilterBar.tsx` with horizontal scroll on small viewports.
* [ ] Build composite feed container `src/components/feed/ActivityFeed.tsx` with athlete lookup, loading, and empty states.
* [ ] Assemble `src/App.tsx` uniting the 3-column desktop grid (`xl`), 2-column tablet grid (`md`), and single-column mobile view with interactive modals and demo reset button.
* [ ] Verify layout responsiveness across 360px, 390px, 430px, 768px, 1024px, and 1280px+ viewports without horizontal page overflow.
* [ ] Final Verification: Run `npm run lint && tsc -b && vite build` with zero errors or warnings.