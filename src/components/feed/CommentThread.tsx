import { useRef, useState, type FormEvent } from 'react';
import type { ActivityComment } from '../../types/fitness';
import { formatRelativeTime, initialsFromName, stripInvisibleCharacters } from '../../utils/formatters';
import { AlertIcon, CheckIcon, CloseIcon, TrashIcon } from '../icons/ActionIcons';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

export interface CommentThreadProps {
  comments: ActivityComment[];
  /** Author of the signed-in athlete, used to hide delete on other people's comments. */
  currentUserId: string;
  currentUserName: string;
  /** Returns false when the write failed; the draft is then kept. */
  onSubmit: (content: string) => boolean;
  onDelete: (commentId: string) => void;
  /** Trims the text before it is stored. */
  maxLength?: number;
}

/**
 * Comment list plus composer for one activity.
 *
 * Two rules guard the data: a failed write keeps the athlete's text so nothing
 * is lost, and deleting a comment takes a second deliberate tap.
 */
export function CommentThread({
  comments,
  currentUserId,
  currentUserName,
  onSubmit,
  onDelete,
  maxLength = 300,
}: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Id of the comment awaiting a confirming tap. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = draft.trim();
  const remaining = maxLength - draft.length;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return;

    // Trojan-source characters are stripped on the way in, not only on display.
    const clean = stripInvisibleCharacters(trimmed);
    if (!clean) {
      setSubmitError('That comment contained no visible characters.');
      return;
    }

    const saved = onSubmit(clean);
    if (!saved) {
      // Keep what the athlete typed: clearing it would destroy the comment and
      // leave no trace of why nothing happened.
      setSubmitError('Your comment could not be saved. Browser storage may be full.');
      return;
    }

    setSubmitError(null);
    setDraft('');
    // Posting empties the draft and disables the submit button, which would
    // otherwise drop focus to <body> and strand keyboard and screen reader users.
    composerRef.current?.focus();
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
              const isPendingDelete = pendingDeleteId === comment.id;

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
                        <time dateTime={comment.createdAt}>
                          {formatRelativeTime(comment.createdAt)}
                        </time>
                      </span>
                    </div>

                    <p className="text-sm break-words whitespace-pre-wrap text-ink-secondary">
                      {comment.content}
                    </p>

                    {isOwn ? (
                      isPendingDelete ? (
                        <div
                          role="group"
                          aria-label="Confirm comment deletion"
                          data-testid="comment-delete-confirm-row"
                          className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-sport-run/40 bg-sport-run/10 px-2 py-1.5"
                        >
                          <span className="text-xs font-semibold text-sport-run">
                            Delete this comment?
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Cancel comment deletion"
                              data-testid="comment-delete-cancel"
                              onClick={() => setPendingDeleteId(null)}
                              iconLeft={<CloseIcon className="w-3.5 h-3.5" />}
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              data-testid="comment-delete-confirm"
                              onClick={() => {
                                setPendingDeleteId(null);
                                onDelete(comment.id);
                              }}
                              iconLeft={<CheckIcon className="w-3.5 h-3.5" />}
                            >
                              Delete
                            </Button>
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(comment.id)}
                          data-testid="comment-delete"
                          aria-label={`Delete comment by ${comment.userName}`}
                          className="mt-1 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1 rounded text-xs font-semibold text-ink-tertiary transition-colors hover:text-sport-run focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )
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
            ref={composerRef}
            data-testid="comment-input"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value.slice(0, maxLength))}
            rows={2}
            maxLength={maxLength}
            placeholder="Add a comment…"
            aria-invalid={submitError ? true : undefined}
            aria-describedby={submitError ? 'comment-submit-error' : undefined}
            className="min-h-11 w-full resize-none rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-base text-ink-primary placeholder:text-ink-tertiary focus:border-strava-orange/70 focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70 aria-[invalid=true]:border-sport-run/70"
          />

          {submitError ? (
            <p
              id="comment-submit-error"
              role="alert"
              data-testid="comment-submit-error"
              className="flex items-center gap-1.5 text-xs text-sport-run"
            >
              <AlertIcon className="w-3.5 h-3.5 shrink-0" />
              {submitError}
            </p>
          ) : remaining < 40 ? (
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
