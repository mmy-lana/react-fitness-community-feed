import { CommentIcon, ThumbsUpIcon } from '../icons/ActionIcons';

export interface ActivitySocialBarProps {
  kudosCount: number;
  commentCount: number;
  /** Whether the signed-in athlete has already given kudos. */
  hasGivenKudos: boolean;
  onToggleKudos: () => void;
  onOpenComments: () => void;
}

const ACTION_CLASSES =
  'min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange ' +
  'disabled:opacity-45 disabled:cursor-not-allowed';

/** Kudos and comment affordances; both targets clear the 44px minimum. */
export function ActivitySocialBar({
  kudosCount,
  commentCount,
  hasGivenKudos,
  onToggleKudos,
  onOpenComments,
}: ActivitySocialBarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleKudos}
        aria-pressed={hasGivenKudos}
        data-testid="kudos-button"
        data-kudos-count={kudosCount}
        data-kudos-active={hasGivenKudos}
        className={`${ACTION_CLASSES} flex items-center gap-2 border ${
          hasGivenKudos
            ? 'border-strava-orange/40 bg-strava-orange/15 text-strava-orange'
            : 'border-surface-600 bg-surface-800 text-ink-secondary hover:bg-surface-700 hover:text-ink-primary'
        }`}
      >
        <ThumbsUpIcon className="w-4 h-4" />
        <span>Kudos</span>
        <span className="tabular-nums">{kudosCount}</span>
      </button>

      <button
        type="button"
        onClick={onOpenComments}
        data-testid="comment-button"
        data-comment-count={commentCount}
        className={`${ACTION_CLASSES} flex items-center gap-2 border border-surface-600 bg-surface-800 text-ink-secondary hover:bg-surface-700 hover:text-ink-primary`}
      >
        <CommentIcon className="w-4 h-4" />
        <span>Comments</span>
        <span className="tabular-nums">{commentCount}</span>
      </button>
    </div>
  );
}
