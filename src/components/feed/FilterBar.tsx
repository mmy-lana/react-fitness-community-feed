import type { ActivityFilterCriteria, SportType } from '../../types/fitness';
import { SPORT_LABEL_MAP, SPORT_TYPES } from '../../utils/sportMaps';
import { SearchIcon } from '../icons/ActionIcons';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

export interface FilterBarProps {
  filters: ActivityFilterCriteria;
  onChange: (filters: ActivityFilterCriteria) => void;
  visibleCount: number;
  totalCount: number;
  className?: string;
}

const SORT_OPTIONS = [
  { value: 'latest', label: 'Most recent' },
  { value: 'distance', label: 'Longest distance' },
  { value: 'duration', label: 'Longest time' },
  { value: 'kudos', label: 'Most kudos' },
] as const;

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
] as const;

/**
 * Feed controls: sport chips, sorting, date window and search.
 *
 * The chip row scrolls horizontally on a phone instead of wrapping, so the
 * bar never grows taller than the sticky header it lives under.
 */
export function FilterBar({
  filters,
  onChange,
  visibleCount,
  totalCount,
  className = '',
}: FilterBarProps) {
  const patch = (changes: Partial<ActivityFilterCriteria>) => onChange({ ...filters, ...changes });

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="relative flex items-center md:hidden">
        <SearchIcon className="pointer-events-none absolute left-3 w-4 h-4 text-ink-tertiary" />
        <label htmlFor="filter-search" className="sr-only">
          Search activities
        </label>
        <input
          id="filter-search"
          type="search"
          value={filters.searchQuery}
          onChange={(event) => {
            const { value } = event.currentTarget;
            patch({ searchQuery: value });
          }}
          placeholder="Search titles and descriptions…"
          aria-label="Search activities"
          data-testid="feed-search"
          className="min-h-11 w-full rounded-lg border border-surface-600 bg-surface-800 pl-10 pr-3 text-base text-ink-primary placeholder:text-ink-tertiary focus:border-strava-orange/70 focus:outline-2 focus:outline-offset-0 focus:outline-strava-orange/70"
        />
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <Button
          size="sm"
          variant={filters.sportType === 'all' ? 'primary' : 'secondary'}
          aria-label="Filter by All"
          aria-pressed={filters.sportType === 'all'}
          onClick={() => patch({ sportType: 'all' })}
        >
          All
        </Button>

        {SPORT_TYPES.map((sport: SportType) => (
          <Button
            key={sport}
            size="sm"
            variant={filters.sportType === sport ? 'primary' : 'secondary'}
            aria-label={`Filter by ${SPORT_LABEL_MAP[sport]}`}
            aria-pressed={filters.sportType === sport}
            onClick={() => patch({ sportType: sport })}
          >
            {SPORT_LABEL_MAP[sport]}
          </Button>
        ))}

        <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-ink-tertiary">
          {visibleCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? 'activity' : 'activities'}`
            : `${visibleCount} of ${totalCount} activities`}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Sort by"
          options={SORT_OPTIONS}
          value={filters.sortBy}
          onValueChange={(value) => patch({ sortBy: value })}
          data-testid="filter-sort"
        />
        <Select
          label="Date range"
          options={DATE_RANGE_OPTIONS}
          value={filters.dateRange}
          onValueChange={(value) => patch({ dateRange: value })}
          data-testid="filter-date-range"
        />
      </div>
    </div>
  );
}
