import { useEffect, useState } from 'react';
import type { Activity, AthleteDirectoryEntry } from '../../types/fitness';
import { formatRelativeTime } from '../../utils/formatters';
import { AlertIcon, TrashIcon } from '../icons/ActionIcons';
import { Avatar } from '../ui/Avatar';
import { PrivacyBadge, SportBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface ActivityHeaderProps {
  activity: Activity;
  athlete: AthleteDirectoryEntry;
  /** Enables the delete affordance; only the author ever sees it. */
  isOwner: boolean;
  onDelete?: () => void;
}

/**
 * Author row: avatar, name, sport, privacy and the activity timestamp.
 *
 * Deleting an activity is irreversible, so the trash button first asks for
 * confirmation inline. A second click within the same row is required; nothing
 * is removed on the first tap.
 */
export function ActivityHeader({ activity, athlete, isOwner, onDelete }: ActivityHeaderProps) {
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isConfirmingDelete) return;
    const handlePointerDown = (event: PointerEvent) => {
      const row = document.querySelector('[data-testid="activity-delete-confirm-row"]');
      if (row && !row.contains(event.target as Node)) {
        setConfirmingDelete(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isConfirmingDelete]);

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

        {isConfirmingDelete && onDelete ? (
          <div
            role="group"
            aria-label="Confirm activity deletion"
            data-testid="activity-delete-confirm-row"
            className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-sport-run/40 bg-sport-run/10 px-2.5 py-1.5"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sport-run">
              <AlertIcon className="w-3.5 h-3.5" />
              Delete this activity permanently?
            </span>
            <span className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                data-testid="activity-delete-cancel"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                data-testid="activity-delete-confirm"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
            </span>
          </div>
        ) : null}
      </div>

      {isOwner && onDelete && !isConfirmingDelete ? (
        <Button
          variant="danger"
          size="icon"
          aria-label="Delete activity"
          onClick={() => setConfirmingDelete(true)}
          className="-mr-1 -mt-1 shrink-0"
          iconLeft={<TrashIcon className="w-4 h-4" />}
        />
      ) : null}
    </header>
  );
}
