import type { ComponentType, HTMLAttributes, ReactNode } from 'react';
import type { SportType } from '../../types/fitness';
import { SPORT_BG_MAP, SPORT_LABEL_MAP, SPORT_SOLID_MAP } from '../../utils/sportMaps';
import type { ActionIconProps } from '../icons/ActionIcons';
import { GlobeIcon, LockIcon, UsersOnlyIcon } from '../icons/ActionIcons';
import { SportIcon } from '../icons/SportIcons';

export type BadgeTone = 'neutral' | 'positive' | 'warning';
export type PrivacySettingTag = 'public' | 'followers' | 'private';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Leading glyph. */
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Layout only. Colour is deliberately not applied here: Tailwind emits every
 * background utility with the same specificity, so a caller-supplied colour
 * class would lose against a tone class declared in the same element.
 */
const BASE_CLASSES =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ' +
  'text-[11px] font-semibold uppercase tracking-wide';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-700 text-ink-secondary border-surface-600',
  positive: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

function BadgeFrame({ icon, className = '', children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={[BASE_CLASSES, className].filter(Boolean).join(' ')}>
      {icon}
      {children}
    </span>
  );
}

/** Small pill for metadata: status, counters, completion state. */
export function Badge({ tone = 'neutral', icon, className = '', children, ...rest }: BadgeProps) {
  return (
    <BadgeFrame {...rest} icon={icon} className={[TONE_CLASSES[tone], className].join(' ')}>
      {children}
    </BadgeFrame>
  );
}

export interface SportBadgeProps extends Omit<BadgeProps, 'tone'> {
  sport: SportType;
  /** Keeps the glyph only; the sport name stays available to screen readers. */
  compact?: boolean;
  /** Renders a solid dot instead of the sport glyph. */
  dot?: boolean;
}

/** Sport chip coloured from the static sport maps. */
export function SportBadge({
  sport,
  compact = false,
  dot = false,
  className = '',
  icon,
  ...rest
}: SportBadgeProps) {
  return (
    <BadgeFrame
      {...rest}
      data-testid="sport-badge"
      data-sport={sport}
      icon={
        icon ??
        (dot ? (
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${SPORT_SOLID_MAP[sport]}`}
            aria-hidden="true"
          />
        ) : (
          <SportIcon sport={sport} className="w-3.5 h-3.5" />
        ))
      }
      className={[SPORT_BG_MAP[sport], className].join(' ')}
    >
      {compact ? <span className="sr-only">{SPORT_LABEL_MAP[sport]}</span> : dot ? null : SPORT_LABEL_MAP[sport]}
    </BadgeFrame>
  );
}

export interface PrivacyBadgeProps extends Omit<BadgeProps, 'tone'> {
  privacy: PrivacySettingTag;
}

const PRIVACY_LABEL: Record<PrivacySettingTag, string> = {
  public: 'Public',
  followers: 'Followers',
  private: 'Only you',
};

const PRIVACY_CLASSES: Record<PrivacySettingTag, string> = {
  public: 'bg-transparent text-ink-tertiary border-surface-600',
  followers: 'bg-surface-700/60 text-ink-secondary border-surface-600',
  private: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const PRIVACY_GLYPHS: Record<PrivacySettingTag, ComponentType<ActionIconProps>> = {
  public: GlobeIcon,
  followers: UsersOnlyIcon,
  private: LockIcon,
};

/** Who can see an activity, with the matching glyph. */
export function PrivacyBadge({ privacy, className = '', icon, ...rest }: PrivacyBadgeProps) {
  const Glyph = PRIVACY_GLYPHS[privacy];
  return (
    <BadgeFrame
      {...rest}
      data-testid="privacy-badge"
      data-privacy={privacy}
      icon={icon ?? <Glyph className="w-3 h-3" />}
      className={[PRIVACY_CLASSES[privacy], className].join(' ')}
    >
      {PRIVACY_LABEL[privacy]}
    </BadgeFrame>
  );
}
