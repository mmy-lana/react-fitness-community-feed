import type { ReactNode } from 'react';
import type { AthleteDirectoryEntry } from '../../types/fitness';
import { BottomNav, type BottomNavItem } from './BottomNav';
import { Header } from './Header';

export interface AppShellProps {
  athlete: AthleteDirectoryEntry;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenLog: () => void;
  activeNavItem: BottomNavItem;
  onNavigate: (item: BottomNavItem) => void;
  children: ReactNode;
}

/**
 * Page chrome.
 *
 * The bottom navigation is fixed on phones, so the content column carries a
 * bottom padding of the nav height plus the safe-area inset — otherwise the
 * last card sits permanently underneath it.
 */
export function AppShell({
  athlete,
  searchQuery,
  onSearchChange,
  onOpenLog,
  activeNavItem,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-surface-900">
      <Header
        athlete={athlete}
        onOpenLog={onOpenLog}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-10">
        {children}
      </div>

      <BottomNav onOpenLog={onOpenLog} activeItem={activeNavItem} onNavigate={onNavigate} />
    </div>
  );
}
