import type { ComponentType, ReactNode } from 'react';
import type { SportType } from '../../types/fitness';

export interface SportIconProps {
  /** Tailwind sizing/colour classes; defaults to a 1rem square. */
  className?: string;
  /** Accessible name. Omit when the icon sits next to a visible label. */
  title?: string;
}

interface IconFrameProps extends SportIconProps {
  children: ReactNode;
}

function IconFrame({ className = 'w-4 h-4', title, children }: IconFrameProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Runner: torso, arms and legs in mid-stride. */
export function RunIcon({ className, title }: SportIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="14.5" cy="4.5" r="2" />
      <path d="M13.6 8.4 10.2 11.6l2.8 2.4-1.5 5.4" />
      <path d="M13.6 8.4 16.8 10.8l2.7-.7" />
      <path d="M10.2 11.6 7.5 10.4" />
      <path d="M13 14 17.2 15.6l.9 4" />
    </IconFrame>
  );
}

/** Road bike: two wheels, a saddle and a bar line. */
export function RideIcon({ className, title }: SportIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M15.2 5.5h1.6l-2.9 7H9.2" />
      <path d="M9.2 12.5 6.2 17" />
      <path d="M12.4 12.5 15.4 17" />
    </IconFrame>
  );
}

/** Open water: a swimmer's head and arm above two swells. */
export function SwimIcon({ className, title }: SportIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="17" cy="6.5" r="2" />
      <path d="M14.2 8.4 10.4 11" />
      <path d="M2.5 14.6c2.4 0 2.4 1.9 4.8 1.9s2.4-1.9 4.8-1.9 2.4 1.9 4.8 1.9 2.4-1.9 4.6-1.9" />
      <path d="M2.5 19c2.4 0 2.4 1.9 4.8 1.9s2.4-1.9 4.8-1.9 2.4 1.9 4.8 1.9 2.4-1.9 4.6-1.9" />
    </IconFrame>
  );
}

/** Hike: two peaks with a low sun. */
export function HikeIcon({ className, title }: SportIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="18" cy="5.5" r="2" />
      <path d="M2.5 19 9 7.5l3.6 6L15 9l6.5 10z" />
    </IconFrame>
  );
}

/** Workout: a dumbbell seen from the side. */
export function WorkoutIcon({ className, title }: SportIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11" />
    </IconFrame>
  );
}

/** Icon for a sport, used by badges, filter tabs and card headers. */
const SPORT_ICON_MAP: Record<SportType, ComponentType<SportIconProps>> = {
  run: RunIcon,
  ride: RideIcon,
  swim: SwimIcon,
  hike: HikeIcon,
  workout: WorkoutIcon,
};

/** Renders the icon registered for `sport`. */
export function SportIcon({
  sport,
  className,
  title,
}: {
  sport: SportType;
  className?: string;
  title?: string;
}) {
  const Icon = SPORT_ICON_MAP[sport];
  return <Icon className={className} title={title} />;
}
