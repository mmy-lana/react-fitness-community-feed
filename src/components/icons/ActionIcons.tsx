import type { ReactNode } from 'react';

export interface ActionIconProps {
  /** Tailwind sizing/colour classes; defaults to a 1rem square. */
  className?: string;
  /** Accessible name. Omit when the icon sits next to a visible label. */
  title?: string;
}

interface IconFrameProps extends ActionIconProps {
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

export function SearchIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </IconFrame>
  );
}

export function PlusIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M12 5v14M5 12h14" />
    </IconFrame>
  );
}

export function CloseIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M6 18 18 6M6 6l12 12" />
    </IconFrame>
  );
}

/** Kudos: a raised thumb, Strava-style reaction. */
export function ThumbsUpIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M7 10.5 10.6 4a2 2 0 0 1 2.9 2.3l-.9 3.2h5.1a2 2 0 0 1 2 2.5l-1.5 6.2a2.5 2.5 0 0 1-2.4 2H7z" />
      <path d="M7 10.5H4.8a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H7z" />
    </IconFrame>
  );
}

export function CommentIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z" />
    </IconFrame>
  );
}

export function TrashIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
      <path d="M10.5 10v6.5M13.5 10v6.5" />
    </IconFrame>
  );
}

export function HomeIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </IconFrame>
  );
}

export function TrophyIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" />
      <path d="M12 14v3.5M8.5 20.5h7" />
    </IconFrame>
  );
}

export function UsersIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.4a5.5 5.5 0 0 1 3 5.1" />
    </IconFrame>
  );
}

export function RotateCcwIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M4.5 9.5A8 8 0 1 1 4 14" />
      <path d="M3.5 4.5v5h5" />
    </IconFrame>
  );
}

export function LockIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </IconFrame>
  );
}

export function GlobeIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z" />
    </IconFrame>
  );
}

export function UsersOnlyIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 10.8-6.7M14.7 13.8a3.5 3.5 0 0 1 4.8 3.2v3.5" />
    </IconFrame>
  );
}

export function ChevronDownIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="m6 9.5 6 5.5 6-5.5" />
    </IconFrame>
  );
}

export function ChevronRightIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="m9.5 6 5.5 6-5.5 6" />
    </IconFrame>
  );
}

export function ExpandIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M9.5 4.5h-5v5M14.5 4.5h5v5M9.5 19.5h-5v-5M14.5 19.5h5v-5" />
    </IconFrame>
  );
}

export function ClockIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </IconFrame>
  );
}

export function FlameIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M12 3.5s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 1.5 1 2.5 2 2.5 1.5 0 2-1.5 1-7z" />
    </IconFrame>
  );
}

export function MountainIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M2.5 18.5 9 7.5l3.6 6L15 9l6.5 9.5z" />
    </IconFrame>
  );
}

export function RouteIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="18" cy="5.5" r="2.5" />
      <path d="M8.5 18.5h4a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7h6" />
    </IconFrame>
  );
}

export function MapPinIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconFrame>
  );
}

export function CalendarIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </IconFrame>
  );
}

export function CheckIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </IconFrame>
  );
}

export function AlertIcon({ className, title }: ActionIconProps) {
  return (
    <IconFrame className={className} title={title}>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.8v.2" />
    </IconFrame>
  );
}
