export const CARD_COLOR_KEYS = [
  'ochre',
  'rose',
  'blue',
  'olive',
  'grey',
] as const;
export type CardColorKey = (typeof CARD_COLOR_KEYS)[number];
