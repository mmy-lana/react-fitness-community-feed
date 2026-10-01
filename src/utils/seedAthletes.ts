import type { AthleteDirectoryEntry } from '../types/fitness';

/** Identifier of the signed-in athlete. Every ownership guard compares to this. */
export const CURRENT_USER_ID = 'athlete-me-01';

/**
 * Author directory backing every activity in the feed. Lookups fall back to a
 * neutral entry so a post never renders an empty header, even if its author id
 * is missing from persisted data.
 */
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

/** Fallback used whenever an unknown athlete id is requested. */
const UNKNOWN_ATHLETE: AthleteDirectoryEntry = {
  fullName: 'Community Athlete',
  username: 'athlete',
  avatarInitials: 'CA',
  location: 'Global',
};

export function getAthlete(userId: string): AthleteDirectoryEntry {
  return ATHLETE_DIRECTORY[userId] ?? UNKNOWN_ATHLETE;
}
