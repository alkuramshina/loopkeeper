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
