import { useState } from 'react';
import type { PrivacySetting, SportType } from './types/fitness';
import {
  CheckIcon,
  CloseIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  TrashIcon,
} from './components/icons/ActionIcons';
import { SportIcon } from './components/icons/SportIcons';
import { Avatar } from './components/ui/Avatar';
import { Badge, PrivacyBadge, SportBadge } from './components/ui/Badge';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { MetricPill } from './components/ui/MetricPill';
import { Modal } from './components/ui/Modal';
import { Select } from './components/ui/Select';
import { SPORT_LABEL_MAP, SPORT_TYPES } from './utils/sportMaps';

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public — anyone can see it' },
  { value: 'followers', label: 'Followers only' },
  { value: 'private', label: 'Only me' },
] as const;

const SPORT_OPTIONS = SPORT_TYPES.map((sport) => ({ value: sport, label: SPORT_LABEL_MAP[sport] }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Design-system preview. Each phase replaces the previous one as the real
 * surfaces land; it keeps the primitives reachable in a running app instead of
 * only in a component test.
 */
export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [sport, setSport] = useState<SportType>('run');
  const [privacy, setPrivacy] = useState<PrivacySetting>('public');
  const [title, setTitle] = useState('Sunrise Ridge Trail Run');
  const [distance, setDistance] = useState('10.45');

  return (
    <main className="min-h-dvh bg-surface-900 text-ink-primary">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:px-6">
        <header className="flex flex-col gap-2">
          <span className="text-strava-orange text-xs font-bold uppercase tracking-widest">Phase 2</span>
          <h1 className="text-2xl font-bold tracking-tight">Design system primitives</h1>
          <p className="text-sm text-ink-secondary">
            Buttons, badges, avatars, metrics, form controls and the dialog primitive — rendered against the
            real Tailwind theme tokens.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" iconLeft={<PlusIcon className="w-4 h-4" />}>
              Log Activity
            </Button>
            <Button variant="secondary">Follow</Button>
            <Button variant="ghost">Dismiss</Button>
            <Button variant="danger" iconLeft={<TrashIcon className="w-4 h-4" />}>
              Delete
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="secondary" size="md">
              Medium
            </Button>
            <Button variant="secondary" size="lg">
              Large
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Search preview"
              iconLeft={<SearchIcon className="w-4 h-4" />}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reset preview"
              iconLeft={<RotateCcwIcon className="w-4 h-4" />}
            />
          </div>
          <Button variant="primary" fullWidth onClick={() => setModalOpen(true)}>
            Open modal preview
          </Button>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-2">
            {SPORT_TYPES.map((value) => (
              <SportBadge key={value} sport={value} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SportBadge sport="swim" compact />
            <SportBadge sport="ride" dot />
            <PrivacyBadge privacy="public" />
            <PrivacyBadge privacy="followers" />
            <PrivacyBadge privacy="private" />
            <Badge tone="positive" icon={<CheckIcon className="w-3 h-3" />}>
              Goal met
            </Badge>
          </div>
        </Section>

        <Section title="Avatars">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar initials="AR" name="Alex Reynolds" size="xs" />
            <Avatar initials="ER" name="Elena Rostova" size="sm" />
            <Avatar initials="MV" name="Marcus Vance" size="md" />
            <Avatar initials="JP" name="Jamie Park" size="lg" />
            <Avatar initials="" name="Sam Rivers" size="md" />
          </div>
        </Section>

        <Section title="Metrics">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-surface-700/60 bg-surface-800/60 p-4 xs:grid-cols-3">
            <MetricPill label="Distance" value="10.45" unit="km" />
            <MetricPill label="Time" value="52:00" />
            <MetricPill label="Pace" value="4:59" unit="/km" />
            <MetricPill label="Elev Gain" value="285" unit="m" />
            <MetricPill label="Calories" value="612" unit="kcal" emphasis />
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Title"
              required
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              data-testid="preview-title"
            />
            <Input
              label="Distance"
              unit={sport === 'swim' ? 'm' : 'km'}
              inputMode="decimal"
              value={distance}
              onChange={(event) => setDistance(event.currentTarget.value)}
            />
            <Input
              label="Duration"
              hint="Minutes and seconds"
              inputMode="numeric"
              defaultValue="52"
            />
            <Input
              label="Title (invalid)"
              defaultValue=""
              error="Give the activity a title."
              data-testid="preview-invalid"
            />
            <Select
              label="Sport"
              options={SPORT_OPTIONS}
              value={sport}
              onValueChange={setSport}
              data-testid="preview-sport"
            />
            <Select
              label="Privacy"
              options={PRIVACY_OPTIONS}
              value={privacy}
              onValueChange={setPrivacy}
            />
          </div>
        </Section>

        <Section title="Sport icons">
          <div className="flex flex-wrap items-center gap-4">
            {SPORT_TYPES.map((value) => (
              <span key={value} className="flex flex-col items-center gap-1 text-ink-tertiary">
                <SportIcon sport={value} className="h-6 w-6 text-ink-primary" />
                <span className="text-[11px]">{SPORT_LABEL_MAP[value]}</span>
              </span>
            ))}
          </div>
        </Section>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal primitive"
        description="Native dialog: focus trap, Escape and backdrop dismissal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-secondary">
          The scroll lock is reference counted, so closing one dialog never unlocks the page while another is
          still open.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Badge tone="neutral" icon={<CloseIcon className="w-3 h-3" />}>
            Scroll locked
          </Badge>
        </div>
      </Modal>
    </main>
  );
}
