import { useState, type FormEvent } from 'react';
import type { ActivityComment } from '../../types/fitness';
import { formatRelativeTime, initialsFromName } from '../../utils/formatters';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { TrashIcon } from '../icons/ActionIcons';

export interface CommentThreadProps {
  comments: ActivityComment[];
  /** Author of the signed-in athlete, used to hide delete on other people's comments. */
  currentUserId: string;
  currentUserName: string;
  onSubmit: (content: string) => void;
  onDelete: (commentId: string) => void;
  /** Trims the text before it is stored. */
  maxLength?: number;
}

/** Comment list plus composer for one activity. */
export function CommentThread({
  comments,
  currentUserId,
  currentUserName,
  onSubmit,
  onDelete,
  maxLength = 300,
}: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  const remaining = maxLength - draft.length;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-surface-600 px-4 py-6 text-center text-sm text-ink-tertiary">
            No comments yet — be the first to cheer this one on.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => {
              const isOwn = comment.userId === currentUserId;
              return (
                <li key={comment.id} className="flex items-start gap-2.5" data-testid="comment-item">
                  <Avatar
                    initials={initialsFromName(comment.userName)}
                    name={comment.userName}
                    size="sm"
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-surface-900/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-ink-primary">
                        {comment.userName}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-tertiary">
                        <time dateTime={comment.createdAt}>{formatRelativeTime(comment.createdAt)}</time>
                      </span>
                    </div>

                    <p className="text-sm break-words whitespace-pre-wrap text-ink-secondary">
                      {comment.content}
                    </p>

                    {isOwn ? (
                      <button
                        type="button"
                        onClick={() => onDelete(comment.id)}
                        data-testid="comment-delete"
                        aria-label={`Delete comment by ${comment.userName}`}
                        className="mt-1 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1 rounded text-xs font-semibold text-ink-tertiary transition-colors hover:text-sport-run focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="comment-draft" className="sr-only">
            Add a comment as {currentUserName}
          </label>
          <textarea
            id="comment-draft"
            data-testid="comment-input"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value.slice(0, maxLength))}
            rows={2}
            maxLength={maxLength}
            placeholder="Add a comment…"
            className="min-h-11 w-full resize-none rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-base text-ink-primary placeholder:text-ink-tertiary focus:border-strava-orange/70 focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70"
          />
          {remaining < 40 ? (
            <span className="text-[11px] text-ink-tertiary">{remaining} characters left</span>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          data-testid="comment-submit"
          disabled={!trimmed}
          className="shrink-0"
        >
          Post
        </Button>
      </form>
    </div>
  );
}
