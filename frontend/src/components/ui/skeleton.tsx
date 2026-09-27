import { CSSProperties } from 'react';

/**
 * Placeholder that repeats the final layout, so nothing jumps after loading.
 * Decorative: the surrounding region announces the loading state.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius,
}: {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: 'sm' | 'md' | 'pill';
}) {
  return (
    <span
      aria-hidden="true"
      className={['ui-skeleton', radius && `ui-skeleton-${radius}`]
        .filter(Boolean)
        .join(' ')}
      style={{ width, height }}
    />
  );
}
