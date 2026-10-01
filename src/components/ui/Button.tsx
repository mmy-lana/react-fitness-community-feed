import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches the button across its container. */
  fullWidth?: boolean;
  /** Leading icon; sized to the current font by default. */
  iconLeft?: ReactNode;
  /** Trailing icon. */
  iconRight?: ReactNode;
  /** React 19 passes `ref` as a plain prop — no forwardRef wrapper. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Static class tables. Tailwind v4 only emits classes it can see at build
 * time, so variants are never assembled from interpolated fragments.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-strava-orange text-white shadow-sm hover:bg-strava-orange-hover active:bg-strava-orange-hover',
  secondary:
    'bg-surface-700 text-ink-primary border border-surface-600 hover:bg-surface-600 active:bg-surface-600',
  ghost:
    'bg-transparent text-ink-secondary border border-transparent hover:bg-surface-700/70 hover:text-ink-primary',
  danger:
    'bg-transparent text-sport-run border border-sport-run/40 hover:bg-sport-run/15 hover:text-sport-run',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // min-w-11 keeps a short label ("All", "42") from collapsing below the
  // 44px touch target floor.
  sm: 'min-h-11 min-w-11 px-3 text-xs gap-1.5',
  md: 'min-h-11 min-w-11 px-4 text-sm gap-2',
  lg: 'min-h-11 min-w-11 px-5 text-base gap-2',
  icon: 'min-h-11 min-w-11 w-11 h-11 p-0',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-lg font-semibold cursor-pointer select-none ' +
  'transition-colors duration-150 whitespace-nowrap ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none';

/**
 * The app's only button. Every size keeps a 44px minimum box so every action
 * stays tappable on a phone.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconRight,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
