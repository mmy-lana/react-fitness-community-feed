import { useState } from 'react';
import type { Activity, ActivityComment, AthleteDirectoryEntry } from '../../types/fitness';
import { deriveElevationProfile } from '../../utils/telemetryMath';
import { ElevationChart } from '../charts/ElevationChart';
import { RouteMapCanvas } from '../charts/RouteMapCanvas';
import { Modal } from '../ui/Modal';
import { ActivityHeader } from './ActivityHeader';
import { ActivitySocialBar } from './ActivitySocialBar';
import { ActivityStatsGrid } from './ActivityStatsGrid';
import { CommentThread } from './CommentThread';

export interface ActivityCardProps {
  activity: Activity;
  athlete: AthleteDirectoryEntry;
  /** Signed-in athlete id; drives kudos state and comment ownership. */
  currentUserId: string;
  onToggleKudos: (activityId: string) => void;
  /** Omit to hide delete affordances. */
  onDelete?: (activityId: string) => void;
  onSubmitComment?: (activityId: string, content: string) => void;
  onDeleteComment?: (activityId: string, commentId: string) => void;
}

/**
 * One post: header, metrics, route, elevation and the social bar. The comment
 * dialog only mounts when a submit handler is supplied, so a read-only feed
 * never renders an empty composer.
 */
export function ActivityCard({
  activity,
  athlete,
  currentUserId,
  onToggleKudos,
  onDelete,
  onSubmitComment,
  onDeleteComment,
}: ActivityCardProps) {
  const [isCommentsOpen, setCommentsOpen] = useState(false);
  const [isMapOpen, setMapOpen] = useState(false);

  const isOwner = activity.userId === currentUserId;
  const hasGivenKudos = activity.kudos.some((kudos) => kudos.userId === currentUserId);
  const elevationProfile = deriveElevationProfile(activity.coordinates);
  const canComment = typeof onSubmitComment === 'function';

  const handleSubmitComment = (content: string) => {
    onSubmitComment?.(activity.id, content);
  };

  const handleDeleteComment = (commentId: string) => {
    onDeleteComment?.(activity.id, commentId);
  };

  return (
    <article
      data-testid="activity-card"
      data-sport={activity.sportType}
      data-owner={activity.userId}
      data-kudos={activity.kudos.length}
      aria-labelledby={`activity-title-${activity.id}`}
      className="flex flex-col gap-3 rounded-xl border border-surface-700/60 bg-surface-800 p-4 shadow-sm"
    >
      <ActivityHeader
        activity={activity}
        athlete={athlete}
        isOwner={isOwner}
        onDelete={onDelete ? () => onDelete(activity.id) : undefined}
      />

      <div className="min-w-0">
        <h3
          id={`activity-title-${activity.id}`}
          data-testid="activity-title-text"
          className="text-base leading-snug font-bold text-ink-primary line-clamp-2"
        >
          {activity.title}
        </h3>
        {activity.description ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary line-clamp-3">
            {activity.description}
          </p>
        ) : null}
      </div>

      <ActivityStatsGrid activity={activity} />

      {activity.coordinates.length > 0 ? (
        <>
          <RouteMapCanvas
            coordinates={activity.coordinates}
            sportType={activity.sportType}
            onExpand={() => setMapOpen(true)}
          />
          <ElevationChart profile={elevationProfile} sportType={activity.sportType} />
        </>
      ) : null}

      <ActivitySocialBar
        kudosCount={activity.kudos.length}
        commentCount={activity.comments.length}
        hasGivenKudos={hasGivenKudos}
        onToggleKudos={() => onToggleKudos(activity.id)}
        onOpenComments={() => setCommentsOpen(true)}
      />

      {canComment ? (
        <Modal
          isOpen={isCommentsOpen}
          onClose={() => setCommentsOpen(false)}
          title="Comments"
          description={activity.title}
          size="md"
        >
          <CommentThread
            comments={activity.comments}
            currentUserId={currentUserId}
            currentUserName={athlete.fullName}
            onSubmit={handleSubmitComment}
            onDelete={handleDeleteComment}
          />
        </Modal>
      ) : null}

      <Modal
        isOpen={isMapOpen}
        onClose={() => setMapOpen(false)}
        title={activity.title}
        description={`${activity.sportType} route · ${activity.coordinates.length} GPS points`}
        size="lg"
      >
        <RouteMapCanvas
          coordinates={activity.coordinates}
          sportType={activity.sportType}
          className="aspect-[16/9]"
        />
        <ElevationChart profile={elevationProfile} sportType={activity.sportType} className="mt-4" />
        {activity.comments.length > 0 ? (
          <details className="mt-4 rounded-lg border border-surface-700/60 bg-surface-900/50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-secondary">
              {activity.comments.length} comment{activity.comments.length === 1 ? '' : 's'}
            </summary>
            <CommentList comments={activity.comments} />
          </details>
        ) : null}
      </Modal>
    </article>
  );
}

/** Read-only comment list used inside the expanded route dialog. */
function CommentList({ comments }: { comments: ActivityComment[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg bg-surface-800/70 px-3 py-2">
          <span className="text-xs font-semibold text-ink-primary">{comment.userName}</span>
          <p className="text-sm break-words text-ink-secondary">{comment.content}</p>
        </li>
      ))}
    </ul>
  );
}
