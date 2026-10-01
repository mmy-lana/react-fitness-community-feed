import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';
import { ChevronDownIcon } from '../icons/ActionIcons';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'defaultValue' | 'children'> {
  /** Visible label; always rendered, never placeholder-only. */
  label: string;
  options: readonly SelectOption<T>[];
  value?: T;
  defaultValue?: T;
  /** Typed change handler — callers never cast the raw string. */
  onValueChange?: (value: T) => void;
  /** Validation message. Also flips the field into the invalid state. */
  error?: string;
  /** Helper text rendered under the field when there is no error. */
  hint?: string;
  /** Icon rendered before the control. */
  iconLeft?: ReactNode;
  /** React 19 passes `ref` as a plain prop. */
  ref?: Ref<HTMLSelectElement>;
}

const CONTROL_CLASSES =
  // text-base (not text-sm) keeps iOS Safari from zooming the viewport on focus.
  'w-full min-h-11 text-base rounded-lg bg-surface-900 border text-ink-primary ' +
  'appearance-none transition-colors focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70';

const VALID_CLASSES = 'border-surface-600 focus:border-strava-orange/70';
const INVALID_CLASSES = 'border-sport-run/70 focus:outline-sport-run';

/**
 * Labelled native `<select>`. Native keeps the platform picker, keyboard
 * behaviour and screen-reader semantics instead of re-implementing them.
 */
export function Select<T extends string = string>({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  error,
  hint,
  iconLeft,
  className = '',
  id,
  name,
  required,
  ...rest
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <label htmlFor={selectId} className="text-xs font-semibold text-ink-secondary">
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

        <select
          {...rest}
          id={selectId}
          name={name ?? selectId}
          required={required}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError || hint ? messageId : undefined}
          onChange={(event) => onValueChange?.(event.currentTarget.value as T)}
          className={[
            CONTROL_CLASSES,
            hasError ? INVALID_CLASSES : VALID_CLASSES,
            iconLeft ? 'pl-10 pr-10' : 'pl-3 pr-10',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface-800">
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDownIcon className="absolute right-3 w-4 h-4 text-ink-tertiary pointer-events-none" />
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
