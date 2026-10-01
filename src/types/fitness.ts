/**
 * Domain model for the fitness community feed.
 *
 * This module is intentionally dependency-free: it holds only pure structural
 * types so that services, hooks and presentational components can share one
 * vocabulary without importing React or browser APIs.
 */

/** Every sport the community can log an activity for. */
export type SportType = 'run' | 'ride' | 'swim' | 'hike' | 'workout';

/** Visibility of a single activity inside the community feed. */
export type PrivacySetting = 'public' | 'followers' | 'private';

/** A single GPS sample captured during an activity. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  /** Seconds elapsed from the activity start time. */
  timestampOffsetSeconds: number;
}

/** A point on the elevation profile, keyed by cumulative distance. */
export interface ElevationPoint {
  distanceMeters: number;
  elevationMeters: number;
}

/** The signed-in athlete's profile plus goal configuration. */
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

/** One athlete's "kudos" reaction on an activity. */
export interface KudosRecord {
  userId: string;
  username: string;
  timestamp: string;
}

/** One comment attached to an activity. */
export interface ActivityComment {
  id: string;
  activityId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

/** A logged activity and its social graph. */
export interface Activity {
  id: string;
  userId: string;
  title: string;
  description: string;
  sportType: SportType;
  /** ISO 8601 timestamp of the activity start. */
  startTime: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  calories: number;
  /** GPS track; the elevation profile is derived from this array. */
  coordinates: GeoPoint[];
  kudos: KudosRecord[];
  comments: ActivityComment[];
  privacy: PrivacySetting;
  createdAt: string;
  updatedAt: string;
}

/** A time-boxed community challenge. */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: 'distance' | 'elevation';
  sportTypes: SportType[];
  /** Meters for `distance`, meters climbed for `elevation`. */
  targetValue: number;
  startDate: string;
  endDate: string;
  joined: boolean;
  participantCount: number;
  badgeCode: string;
}

/** Denormalized author information used to render post headers. */
export interface AthleteDirectoryEntry {
  fullName: string;
  username: string;
  avatarInitials: string;
  location: string;
}

/** Roll-up of the signed-in athlete's week, from Monday 00:00 local time. */
export interface WeeklyAggregates {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalElevationGainMeters: number;
  totalActivitiesCount: number;
  targetDistanceMeters: number;
  /** Capped at 100 — safe for rendering progress bars. */
  progressPercentage: number;
  /** Uncapped — safe for rendering headline percentages. */
  actualPercentage: number;
}

/** Criteria applied to the community feed query. */
export interface ActivityFilterCriteria {
  sportType: SportType | 'all';
  sortBy: 'latest' | 'distance' | 'duration' | 'kudos';
  dateRange: 'all' | 'this_week' | 'this_month';
  searchQuery: string;
}

/** Validated payload from the manual activity entry form. */
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
