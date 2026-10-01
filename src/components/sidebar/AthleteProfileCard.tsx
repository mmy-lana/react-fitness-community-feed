import type { UserProfile } from '../../types/fitness';
import { SPORT_LABEL_MAP } from '../../utils/sportMaps';
import { MapPinIcon, UsersIcon } from '../icons/ActionIcons';
import { SportIcon } from '../icons/SportIcons';
import { Avatar } from '../ui/Avatar';

export interface AthleteProfileCardProps {
  profile: UserProfile;
}

/** Identity card for the signed-in athlete. */
export function AthleteProfileCard({ profile }: AthleteProfileCardProps) {
  return (
    <section
      data-testid="athlete-profile"
      aria-label="Your profile"
      className="flex flex-col items-center gap-3 rounded-xl border border-surface-700/60 bg-surface-800 p-4 text-center"
    >
      <Avatar initials={profile.avatarInitials} name={profile.fullName} size="lg" />

      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="truncate text-base font-bold text-ink-primary">{profile.fullName}</h2>
        <p className="truncate text-xs text-ink-tertiary">@{profile.username}</p>
      </div>

      <p className="flex items-center gap-1 text-xs text-ink-secondary">
        <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-ink-tertiary" />
        <span className="truncate">{profile.location}</span>
      </p>

      {profile.bio ? (
        <p className="text-sm leading-relaxed break-words text-ink-secondary">{profile.bio}</p>
      ) : null}

      <div className="flex w-full items-center justify-center gap-4 border-t border-surface-700/60 pt-3">
        <span className="flex flex-col items-center">
          <span className="text-sm font-bold text-ink-primary tabular-nums">
            {profile.followingCount}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Following</span>
        </span>
        <span className="flex flex-col items-center">
          <span className="text-sm font-bold text-ink-primary tabular-nums">
            {profile.followersCount}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Followers</span>
        </span>
      </div>

      <p className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-900/60 px-3 py-2 text-xs text-ink-secondary">
        <SportIcon sport={profile.weeklyGoalSport} className="w-4 h-4 text-strava-orange" />
        <span className="truncate">
          Weekly goal: {(profile.weeklyGoalMeters / 1000).toFixed(0)} km{' '}
          {SPORT_LABEL_MAP[profile.weeklyGoalSport].toLowerCase()}
        </span>
      </p>

      <p className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
        <UsersIcon className="w-3.5 h-3.5" />
        Member since {new Date(profile.createdAt).getFullYear()}
      </p>
    </section>
  );
}
