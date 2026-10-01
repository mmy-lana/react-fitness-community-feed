import { useState } from 'react';
import type { AthleteDirectoryEntry } from '../../types/fitness';
import { CloseIcon, PlusIcon, SearchIcon } from '../icons/ActionIcons';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

export interface HeaderProps {
  athlete: AthleteDirectoryEntry;
  onOpenLog: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

/** `xl` in Tailwind terms — where the feed grows a third column. */
export const DESKTOP_QUERY = '(min-width: 1280px)';

/**
 * Sticky app header.
 *
 * Below `md` the search collapses behind a toggle so the brand and the log
 * action keep the whole width; from `md` up the field is always visible. The
 * collapsed field stays in the DOM (hidden), which keeps its label wired and
 * avoids remounting the input on every resize.
 */
export function Header({ athlete, onOpenLog, searchQuery, onSearchChange }: HeaderProps) {
  const [isSearchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-surface-700/60 bg-surface-900/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 md:px-6">
        <a
          href="#activity-feed"
          className="flex min-h-11 min-w-11 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-strava-orange text-sm font-black text-white">
            FC
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-ink-primary sm:inline">
            Fitness Community
          </span>
        </a>

        <div
          data-testid="header-search"
          className={`${isSearchOpen ? 'flex' : 'hidden'} relative min-w-0 flex-1 items-center md:flex`}
        >
          <label htmlFor="header-search-input" className="sr-only">
            Search activities
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 w-4 h-4 text-ink-tertiary" />
          <input
            id="header-search-input"
            type="search"
            value={searchQuery}
            onChange={(event) => {
              const { value } = event.currentTarget;
              onSearchChange(value);
            }}
            placeholder="Search activities…"
            data-testid="header-search-input"
            className="min-h-11 w-full rounded-lg border border-surface-600 bg-surface-800 pl-10 pr-3 text-base text-ink-primary placeholder:text-ink-tertiary focus:border-strava-orange/70 focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={isSearchOpen ? 'Close search' : 'Search activities'}
            aria-expanded={isSearchOpen}
            aria-controls="header-search-input"
            onClick={() => setSearchOpen((open) => !open)}
            iconLeft={isSearchOpen ? <CloseIcon className="w-5 h-5" /> : <SearchIcon className="w-5 h-5" />}
          />

          <div className="hidden items-center gap-2 md:flex">
            <span className="hidden text-right sm:flex sm:flex-col sm:items-end">
              <span className="text-sm font-semibold text-ink-primary">{athlete.fullName}</span>
              <span className="text-[11px] text-ink-tertiary">@{athlete.username}</span>
            </span>
            <Avatar initials={athlete.avatarInitials} name={athlete.fullName} size="sm" />
          </div>

          <Button
            variant="primary"
            className="hidden md:inline-flex"
            aria-label="Log activity"
            onClick={onOpenLog}
            iconLeft={<PlusIcon className="w-4 h-4" />}
          >
            Log Activity
          </Button>
        </div>
      </div>
    </header>
  );
}
