import { useCallback, useSyncExternalStore } from 'react';

/**
 * Lower bounds of the layout ranges in px. The same values are repeated in
 * CSS media queries, where custom properties cannot be used.
 */
export const breakpoints = {
  /** 600–1023: tablet or narrow window. Below it: phone. */
  tablet: 600,
  /** 1024–1279: small laptop, collapsed sidebar. */
  laptopSmall: 1024,
  /** 1280–1439: the master's main laptop, the mockup layout. */
  laptop: 1280,
  /** 1440 and wider. */
  wide: 1440,
} as const;

/** Media queries of the ranges, written the same way as in CSS. */
export const mediaQueries = {
  phone: `(max-width: ${breakpoints.tablet - 1}px)`,
  /** Header and slide-out menu instead of the sidebar. */
  tablet: `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.laptopSmall - 1}px)`,
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

/** Whether a media query matches now; follows changes of the window. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener('change', onChange);
      return () => media?.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

/** For one-off decisions outside rendering, such as an animated viewport. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.(mediaQueries.reducedMotion).matches ?? false;
}
