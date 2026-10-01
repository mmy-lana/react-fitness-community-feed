import { useMemo, useState, type FormEvent } from 'react';
import type { NewActivityInput, PrivacySetting, SportType } from '../../types/fitness';
import { METRIC_SPORTS, SPORT_LABEL_MAP, SPORT_TYPES } from '../../utils/sportMaps';
import type { RoutePattern } from '../../utils/routeGenerator';
import { AlertIcon } from '../icons/ActionIcons';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';

export interface ManualActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Returns false when the write failed; the form then stays open. */
  onSubmit: (input: NewActivityInput) => boolean;
  defaultSport?: SportType;
}

interface DraftState {
  title: string;
  description: string;
  sportType: SportType;
  date: string;
  time: string;
  durationMinutes: string;
  durationSeconds: string;
  distance: string;
  elevation: string;
  privacy: PrivacySetting;
  routePattern: RoutePattern;
  /** Swimming is entered in meters, everything else in kilometers. */
  distanceUnit: 'km' | 'm';
}

type FormErrors = Partial<Record<keyof DraftState, string>>;

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 280;
/** Five minutes of slack absorbs clock skew between the device and the server. */
const FUTURE_SLACK_MS = 5 * 60 * 1000;
const MAX_DISTANCE_METERS = 500_000;
const MAX_ELEVATION_METERS = 10_000;

const SPORT_OPTIONS = SPORT_TYPES.map((sport) => ({ value: sport, label: SPORT_LABEL_MAP[sport] }));
const PRIVACY_OPTIONS: { value: PrivacySetting; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Followers only' },
  { value: 'private', label: 'Only me' },
];
const ROUTE_OPTIONS: { value: RoutePattern; label: string }[] = [
  { value: 'loop', label: 'Loop' },
  { value: 'out_and_back', label: 'Out & back' },
  { value: 'climb', label: 'Climb' },
  { value: 'stationary', label: 'Stationary' },
];

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** `datetime-local` shape in the athlete's own timezone. */
function toLocalInputValue(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function createInitialState(defaultSport: SportType): DraftState {
  const { date, time } = toLocalInputValue(new Date());
  return {
    title: '',
    description: '',
    sportType: defaultSport,
    date,
    time,
    durationMinutes: '',
    durationSeconds: '',
    distance: '',
    elevation: '',
    privacy: 'public',
    routePattern: defaultSport === 'workout' ? 'stationary' : 'loop',
    distanceUnit: METRIC_SPORTS[defaultSport] ? 'm' : 'km',
  };
}

/** Numeric field must be a finite, non-negative decimal. */
function parseNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateForm(state: DraftState): FormErrors {
  const errors: FormErrors = {};

  const titleLength = state.title.trim().length;
  if (titleLength < 3) errors.title = 'Give the activity a title of at least 3 characters.';
  else if (titleLength > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;

  if (state.description.length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date)) errors.date = 'Pick a start date.';
  if (!/^\d{2}:\d{2}$/.test(state.time)) errors.time = 'Pick a start time.';

  if (!errors.date && !errors.time) {
    const start = new Date(`${state.date}T${state.time}`);
    if (Number.isNaN(start.getTime())) {
      errors.date = 'That start date and time could not be read.';
    } else if (start.getTime() > Date.now() + FUTURE_SLACK_MS) {
      errors.time = 'The start time cannot be in the future.';
    }
  }

  const minutes = parseNumber(state.durationMinutes);
  // An empty seconds box means zero: "45 minutes" should not be a form error.
  const seconds = state.durationSeconds.trim() === '' ? 0 : parseNumber(state.durationSeconds);

  if (minutes === null) errors.durationMinutes = 'Enter the minutes.';
  else if (minutes < 0 || minutes > 59 || !Number.isInteger(minutes)) {
    errors.durationMinutes = 'Minutes must be a whole number between 0 and 59.';
  }

  if (seconds === null || seconds < 0 || seconds > 59 || !Number.isInteger(seconds)) {
    errors.durationSeconds = 'Seconds must be a whole number between 0 and 59.';
  }

  if (minutes !== null && !errors.durationMinutes && !errors.durationSeconds && minutes * 60 + seconds! <= 0) {
    errors.durationMinutes = 'The total duration must be greater than zero.';
  }

  const isWorkout = state.sportType === 'workout';
  const isStationary = state.routePattern === 'stationary';

  if (!isWorkout && !isStationary) {
    const distance = parseNumber(state.distance);
    if (distance === null) errors.distance = 'Enter the distance.';
    else if (distance <= 0) errors.distance = 'The distance must be greater than zero.';
    else if (distance * (state.distanceUnit === 'km' ? 1000 : 1) > MAX_DISTANCE_METERS) {
      errors.distance = 'That distance looks too long for a single activity.';
    }
  }

  if (!isWorkout) {
    const elevation = parseNumber(state.elevation);
    if (elevation === null) errors.elevation = 'Enter the elevation gain, or 0 for flat.';
    else if (elevation < 0 || !Number.isInteger(elevation)) {
      errors.elevation = 'Elevation must be a whole number of meters, zero or more.';
    } else if (elevation > MAX_ELEVATION_METERS) {
      errors.elevation = `Elevation cannot exceed ${MAX_ELEVATION_METERS} m.`;
    }
  }

  return errors;
}

/**
 * Manual entry form.
 *
 * Every rule is enforced in `validateForm` and surfaced on the field itself, so
 * the submit button can stay disabled until the whole form is meaningful
 * instead of failing on submit.
 */
export function ManualActivityModal({
  isOpen,
  onClose,
  onSubmit,
  defaultSport = 'run',
}: ManualActivityModalProps) {
  const [state, setState] = useState<DraftState>(() => createInitialState(defaultSport));
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The caller remounts this component per session (see the `key` in the shell),
  // so every open starts from a clean form without an effect-driven reset.
  const isWorkout = state.sportType === 'workout';
  const isStationary = state.routePattern === 'stationary';
  const distanceDisabled = isWorkout || isStationary;
  // Swims are always entered in meters; other sports default to kilometers.
  const distanceUnitLocked = METRIC_SPORTS[state.sportType];

  const errors = useMemo(() => validateForm(state), [state]);
  const isValid = Object.keys(errors).length === 0;

  const update = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setState((previous) => ({ ...previous, [key]: value }));
  };

  const handleSportChange = (sport: SportType) => {
    const isNowWorkout = sport === 'workout';
    setState((previous) => ({
      ...previous,
      sportType: sport,
      routePattern: isNowWorkout ? 'stationary' : previous.routePattern === 'stationary' ? 'loop' : previous.routePattern,
      distance: isNowWorkout ? '' : previous.distance,
      elevation: isNowWorkout ? '' : previous.elevation,
      distanceUnit: METRIC_SPORTS[sport] ? 'm' : 'km',
    }));
  };

  const handleRoutePatternChange = (pattern: RoutePattern) => {
    setState((previous) => ({
      ...previous,
      routePattern: pattern,
      // A stationary session has no route, so its distance is meaningless.
      distance: pattern === 'stationary' ? '' : previous.distance,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;

    const minutes = Number(state.durationMinutes);
    const seconds = Number(state.durationSeconds);
    const distanceValue = parseNumber(state.distance) ?? 0;

    const saved = onSubmit({
      title: state.title.trim(),
      description: state.description.trim(),
      sportType: state.sportType,
      startTime: new Date(`${state.date}T${state.time}`).toISOString(),
      durationSeconds: minutes * 60 + seconds,
      distanceMeters: distanceDisabled ? 0 : Math.round(distanceValue * (state.distanceUnit === 'km' ? 1000 : 1)),
      elevationGainMeters: isWorkout ? 0 : Math.round(Number(state.elevation) || 0),
      privacy: state.privacy,
      routePattern: distanceDisabled ? 'stationary' : state.routePattern,
    });

    if (!saved) {
      setSubmitError('The activity could not be saved. Browser storage may be full.');
      return;
    }

    setSubmitError(null);
    onClose();
  };

  const distanceUnitButton =
    'min-h-11 min-w-11 cursor-pointer rounded-lg border px-3 text-xs font-bold transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log activity"
      description="Everything stays on this device"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="activity-form"
            data-testid="activity-submit"
            disabled={!isValid}
          >
            Save activity
          </Button>
        </>
      }
    >
      <form id="activity-form" data-testid="activity-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Title"
          required
          maxLength={TITLE_MAX}
          value={state.title}
          onChange={(event) => update('title', event.currentTarget.value)}
          error={errors.title}
          data-testid="activity-title"
          placeholder="Sunrise Ridge Trail Run"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="activity-description" className="text-xs font-semibold text-ink-secondary">
            Description
          </label>
          <textarea
            id="activity-description"
            data-testid="activity-description"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={state.description}
            onChange={(event) => update('description', event.currentTarget.value)}
            placeholder="How did it feel?"
            className="w-full min-h-11 resize-y rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-base text-ink-primary placeholder:text-ink-tertiary focus:border-strava-orange/70 focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70"
          />
          {errors.description ? (
            <p className="text-xs text-sport-run" role="alert">
              {errors.description}
            </p>
          ) : (
            <p className="text-xs text-ink-tertiary">
              {state.description.length}/{DESCRIPTION_MAX}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Sport"
            required
            options={SPORT_OPTIONS}
            value={state.sportType}
            onValueChange={handleSportChange}
            data-testid="activity-sport"
          />
          <Select
            label="Visibility"
            required
            options={PRIVACY_OPTIONS}
            value={state.privacy}
            onValueChange={(value) => update('privacy', value)}
            data-testid="activity-privacy"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Start date"
            type="date"
            required
            value={state.date}
            onChange={(event) => update('date', event.currentTarget.value)}
            error={errors.date}
            data-testid="activity-date"
          />
          <Input
            label="Start time"
            type="time"
            required
            value={state.time}
            onChange={(event) => update('time', event.currentTarget.value)}
            error={errors.time}
            data-testid="activity-time"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold text-ink-secondary">Duration *</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Minutes"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              value={state.durationMinutes}
              onChange={(event) => update('durationMinutes', event.currentTarget.value.replace(/[^\d]/g, '').slice(0, 2))}
              error={errors.durationMinutes}
              data-testid="activity-duration-minutes"
            />
            <Input
              label="Seconds"
              hint="Optional — empty counts as 0"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              value={state.durationSeconds}
              onChange={(event) => update('durationSeconds', event.currentTarget.value.replace(/[^\d]/g, '').slice(0, 2))}
              error={errors.durationSeconds}
              data-testid="activity-duration-seconds"
            />
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-secondary">Distance *</span>
              <div
                role="group"
                aria-label="Distance unit"
                className="flex gap-1"
                data-testid="activity-distance-unit"
              >
                {(['km', 'm'] as const).map((unit) => {
                  const isActive = state.distanceUnit === unit;
                  const isLocked = distanceUnitLocked && unit !== 'm';
                  return (
                    <button
                      key={unit}
                      type="button"
                      aria-pressed={isActive}
                      disabled={isLocked}
                      onClick={() => update('distanceUnit', unit)}
                      className={`${distanceUnitButton} ${
                        isActive
                          ? 'border-strava-orange/50 bg-strava-orange/15 text-strava-orange'
                          : 'border-surface-600 bg-surface-800 text-ink-secondary hover:bg-surface-700'
                      } ${isLocked ? 'cursor-not-allowed opacity-45' : ''}`}
                    >
                      {unit}
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Distance"
              inputMode="decimal"
              min={0}
              step="0.01"
              disabled={distanceDisabled}
              unit={distanceDisabled ? '—' : state.distanceUnit}
              value={state.distance}
              onChange={(event) => update('distance', event.currentTarget.value.replace(/[^\d.]/g, '').slice(0, 7))}
              error={errors.distance}
              hint={
                distanceDisabled
                  ? isWorkout
                    ? 'Workouts are logged by duration only.'
                    : 'A stationary session has no distance.'
                  : undefined
              }
              data-testid="activity-distance"
            />
          </div>

          <Input
            label="Elevation gain"
            inputMode="numeric"
            min={0}
            step={1}
            disabled={isWorkout}
            unit={isWorkout ? '—' : 'm'}
            value={state.elevation}
            onChange={(event) => update('elevation', event.currentTarget.value.replace(/[^\d]/g, '').slice(0, 5))}
            error={errors.elevation}
            hint={isWorkout ? 'Workouts do not record elevation.' : 'Whole meters, zero for flat.'}
            data-testid="activity-elevation"
          />
        </div>

        <Select
          label="Route pattern"
          required
          options={ROUTE_OPTIONS}
          value={state.routePattern}
          onValueChange={handleRoutePatternChange}
          hint={
            isWorkout
              ? 'Workouts are always stationary.'
              : 'Shapes the GPS track generated for this activity.'
          }
          data-testid="activity-route-pattern"
        />

        {submitError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-sport-run/40 bg-sport-run/10 px-3 py-2 text-sm text-sport-run"
          >
            <AlertIcon className="mt-0.5 w-4 h-4 shrink-0" />
            {submitError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
