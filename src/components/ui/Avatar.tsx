import type { HTMLAttributes } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** One or two letters shown inside the disc. */
  initials: string;
  /** Full name — used as the accessible name and to pick a stable colour. */
  name: string;
  size?: AvatarSize;
  /** Overrides the colour derived from the name. */
  tone?: string;
}

/**
 * Initials-only avatar. Nothing here touches the network, so the UI never
 * renders a broken image in an offline demo.
 */
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

/** Fixed palette picked by a stable hash of the athlete's name. */
const TONE_CLASSES = [
  'bg-sport-run/20 text-sport-run',
  'bg-sport-ride/20 text-sport-ride',
  'bg-sport-swim/20 text-sport-swim',
  'bg-sport-hike/20 text-sport-hike',
  'bg-sport-workout/20 text-sport-workout',
  'bg-surface-600 text-ink-secondary',
] as const;

/** djb2 — same name always yields the same disc colour. */
function hashName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Falls back to the first letters of the name when no initials are supplied. */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  initials,
  name,
  size = 'md',
  tone,
  className = '',
  ...rest
}: AvatarProps) {
  const text = initials.trim() || initialsFromName(name);
  const toneClass = tone ?? TONE_CLASSES[hashName(name) % TONE_CLASSES.length];

  return (
    <span
      {...rest}
      role="img"
      aria-label={name}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase select-none',
        SIZE_CLASSES[size],
        toneClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {text}
    </span>
  );
}
