import type { Activity, AthleteDirectoryEntry } from '../../types/fitness';
import { formatRelativeTime } from '../../utils/formatters';
import { Avatar } from '../ui/Avatar';
import { PrivacyBadge, SportBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TrashIcon } from '../icons/ActionIcons';

export interface ActivityHeaderProps {
  activity: Activity;
  athlete: AthleteDirectoryEntry;
  /** Enables the delete affordance; only the author ever sees it. */
  isOwner: boolean;
  onDelete?: () => void;
}

/** Author row: avatar, name, sport, privacy and the activity timestamp. */
export function ActivityHeader({ activity, athlete, isOwner, onDelete }: ActivityHeaderProps) {
  return (
    <header className="flex items-start gap-3">
      <Avatar initials={athlete.avatarInitials} name={athlete.fullName} size="md" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-ink-primary">{athlete.fullName}</span>
          <span className="truncate text-xs text-ink-tertiary">@{athlete.username}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <SportBadge sport={activity.sportType} />
          <PrivacyBadge privacy={activity.privacy} />
          <span className="text-xs text-ink-tertiary">
            <time dateTime={activity.startTime}>{formatRelativeTime(activity.startTime)}</time>
          </span>
        </div>
      </div>

      {isOwner && onDelete ? (
        <Button
          variant="danger"
          size="icon"
          aria-label="Delete activity"
          onClick={onDelete}
          className="-mr-1 -mt-1 shrink-0"
          iconLeft={<TrashIcon className="w-4 h-4" />}
        />
      ) : null}
    </header>
  );
}
