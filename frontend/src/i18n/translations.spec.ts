import { describe, expect, it } from 'vitest';
import i18n from './index';

// Every user-facing string goes through a translation key. A key that is
// missing from the locale silently renders the key itself (or an English
// defaultValue), so check every static key used in the source.
const sources = import.meta.glob<string>(
  ['../**/*.{ts,tsx}', '!../**/*.spec.{ts,tsx}'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

describe('translations', () => {
  it('defines every static key used in the source in the Russian locale', () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
        if (!i18n.exists(match[1])) missing.push(`${match[1]} (${file})`);
      }
    }

    expect(Object.keys(sources).length).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });
});
