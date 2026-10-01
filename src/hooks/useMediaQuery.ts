import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tracks a CSS media query from React state.
 *
 * Only used where the DOM layout itself has to change — the desktop sidebar
 * split. Everything that a stylesheet can express (sticky headers, bottom nav
 * visibility) stays in CSS so there is no flash before the first paint.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
