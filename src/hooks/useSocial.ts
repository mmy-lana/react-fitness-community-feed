import {
  CURRENT_USER_ID,
  generateSafeId,
  getUserSnapshot,
  updateActivities,
} from '../services/storageStore';

/** Hard cap on a single comment so the feed stays readable. */
export const MAX_COMMENT_LENGTH = 300;

/**
 * Adds or removes the signed-in athlete's kudos on an activity.
 * Returns false when the write failed, so callers can surface a storage error.
 */
export function toggleKudos(activityId: string): boolean {
  const currentUser = getUserSnapshot();

  return updateActivities((previous) =>
    previous.map((activity) => {
      if (activity.id !== activityId) return activity;

      const hasGivenKudos = activity.kudos.some((kudos) => kudos.userId === CURRENT_USER_ID);
      const kudos = hasGivenKudos
        ? activity.kudos.filter((kudos) => kudos.userId !== CURRENT_USER_ID)
        : [
            ...activity.kudos,
            {
              userId: CURRENT_USER_ID,
              username: currentUser.username,
              timestamp: new Date().toISOString(),
            },
          ];

      return { ...activity, kudos, updatedAt: new Date().toISOString() };
    })
  );
}

/** Appends a comment. Empty input is ignored rather than stored as a blank. */
export function addComment(activityId: string, content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  const currentUser = getUserSnapshot();

  return updateActivities((previous) =>
    previous.map((activity) => {
      if (activity.id !== activityId) return activity;

      const comment = {
        id: generateSafeId('cmt'),
        activityId,
        userId: CURRENT_USER_ID,
        userName: currentUser.fullName,
        content: trimmed.slice(0, MAX_COMMENT_LENGTH),
        createdAt: new Date().toISOString(),
      };

      return {
        ...activity,
        comments: [...activity.comments, comment],
        updatedAt: new Date().toISOString(),
      };
    })
  );
}

/** Deletes a comment. Only the signed-in athlete's own comments are removed. */
export function deleteComment(activityId: string, commentId: string): boolean {
  let removed = false;

  updateActivities((previous) =>
    previous.map((activity) => {
      if (activity.id !== activityId) return activity;

      const comments = activity.comments.filter((comment) => {
        if (comment.id !== commentId) return true;
        if (comment.userId !== CURRENT_USER_ID) return true;
        removed = true;
        return false;
      });

      return comments.length === activity.comments.length
        ? activity
        : { ...activity, comments, updatedAt: new Date().toISOString() };
    })
  );

  return removed;
}
