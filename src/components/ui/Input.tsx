import { useId, type InputHTMLAttributes, type Ref, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label; always rendered, never placeholder-only. */
  label: string;
  /** Validation message. Also flips the field into the invalid state. */
  error?: string;
  /** Helper text rendered under the field when there is no error. */
  hint?: string;
  /** Unit adornment rendered inside the field, e.g. `km`. */
  unit?: string;
  /** Icon rendered before the input. */
  iconLeft?: ReactNode;
  /** React 19 passes `ref` as a plain prop. */
  ref?: Ref<HTMLInputElement>;
}

const CONTROL_CLASSES =
  // text-base (not text-sm) keeps iOS Safari from zooming the viewport on focus.
  'w-full min-h-11 text-base rounded-lg bg-surface-900 border text-ink-primary placeholder:text-ink-tertiary ' +
  'transition-colors focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70';

const VALID_CLASSES = 'border-surface-600 focus:border-strava-orange/70';
const INVALID_CLASSES = 'border-sport-run/70 focus:outline-sport-run';

/** Labelled text field with inline validation messaging. */
export function Input({
  label,
  error,
  hint,
  unit,
  iconLeft,
  className = '',
  id,
  name,
  required,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <label htmlFor={inputId} className="text-xs font-semibold text-ink-secondary">
        {label}
        {required ? (
          <span className="ml-1 text-strava-orange" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative flex items-center">
        {iconLeft ? (
          <span className="absolute left-3 flex text-ink-tertiary pointer-events-none">{iconLeft}</span>
        ) : null}

        <input
          {...rest}
          id={inputId}
          name={name ?? inputId}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError || hint ? messageId : undefined}
          className={[
            CONTROL_CLASSES,
            hasError ? INVALID_CLASSES : VALID_CLASSES,
            iconLeft ? 'pl-10' : 'pl-3',
            unit ? 'pr-12' : 'pr-3',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {unit ? (
          <span className="absolute right-3 text-xs font-semibold text-ink-tertiary pointer-events-none select-none">
            {unit}
          </span>
        ) : null}
      </div>

      {hasError || hint ? (
        <p
          id={messageId}
          className={`text-xs ${hasError ? 'text-sport-run' : 'text-ink-tertiary'}`}
          role={hasError ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
