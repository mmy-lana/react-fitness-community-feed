import { ATHLETE_DIRECTORY, CURRENT_USER_ID } from '../../utils/seedAthletes';
import { UsersIcon } from '../icons/ActionIcons';
import { Avatar } from '../ui/Avatar';

export interface CommunityCardProps {
  className?: string;
}

/**
 * Who else is posting. The directory is the same source the feed resolves its
 * author headers from, so the list can never drift from the feed.
 */
export function CommunityCard({ className = '' }: CommunityCardProps) {
  const athletes = Object.entries(ATHLETE_DIRECTORY).filter(([id]) => id !== CURRENT_USER_ID);

  return (
    <section
      id="challenges"
      data-testid="community-card"
      data-nav-target="clubs"
      aria-label="Community athletes"
      className={`flex scroll-mt-20 flex-col gap-3 rounded-xl border border-surface-700/60 bg-surface-800 p-4 ${className}`}
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
        <UsersIcon className="w-4 h-4 text-strava-orange" />
        Training with
      </h2>

      <ul className="flex flex-col gap-2">
        {athletes.map(([id, athlete]) => (
          <li key={id} className="flex items-center gap-2.5">
            <Avatar initials={athlete.avatarInitials} name={athlete.fullName} size="sm" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-ink-primary">{athlete.fullName}</span>
              <span className="truncate text-[11px] text-ink-tertiary">@{athlete.username}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-ink-tertiary">
        {athletes.length} athletes in this local demo. No server, no account — everything lives in this
        browser.
      </p>
    </section>
  );
}
