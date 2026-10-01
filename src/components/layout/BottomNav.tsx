import { useEffect, useRef } from 'react';
import { HomeIcon, PlusIcon, TrophyIcon, UsersIcon } from '../icons/ActionIcons';

export interface BottomNavProps {
  onOpenLog: () => void;
  /** Currently highlighted destination. */
  activeItem: BottomNavItem;
  onNavigate: (item: BottomNavItem) => void;
}

export type BottomNavItem = 'feed' | 'weekly' | 'clubs';

const ITEMS: { id: BottomNavItem; label: string; icon: typeof HomeIcon }[] = [
  { id: 'feed', label: 'Feed', icon: HomeIcon },
  { id: 'weekly', label: 'Weekly', icon: TrophyIcon },
  { id: 'clubs', label: 'Clubs', icon: UsersIcon },
];

const ITEM_CLASSES =
  'flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 ' +
  'text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-strava-orange';

/**
 * Thumb-reachable navigation for phones. Hidden from `md` up, where the
 * header carries the same actions, and padded by the safe-area inset so the
 * home indicator never covers a tab.
 */
export function BottomNav({ onOpenLog, activeItem, onNavigate }: BottomNavProps) {
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Scrolling on mount would yank the page away from the top on every load;
    // only a real navigation should move the viewport.
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const target = document.querySelector(`[data-nav-target="${activeItem}"]`);
    target?.scrollIntoView({ block: 'start' });
  }, [activeItem]);

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-700/60 bg-surface-900/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-1 px-2 py-1.5">
        {ITEMS.slice(0, 1).map((item) => (
          <NavItem key={item.id} item={item} active={activeItem === item.id} onNavigate={onNavigate} />
        ))}

        <button
          type="button"
          onClick={onOpenLog}
          aria-label="Log activity"
          className="-mt-6 mx-2 flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-strava-orange text-white shadow-lg shadow-strava-orange/30 transition-colors hover:bg-strava-orange-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange"
        >
          <PlusIcon className="h-6 w-6" />
        </button>

        {ITEMS.slice(1).map((item) => (
          <NavItem key={item.id} item={item} active={activeItem === item.id} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  item,
  active,
  onNavigate,
}: {
  item: { id: BottomNavItem; label: string; icon: typeof HomeIcon };
  active: boolean;
  onNavigate: (item: BottomNavItem) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={active ? 'page' : undefined}
      className={`${ITEM_CLASSES} ${
        active ? 'text-strava-orange' : 'text-ink-tertiary hover:text-ink-primary'
      }`}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </button>
  );
}
