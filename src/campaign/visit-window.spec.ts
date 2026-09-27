import { nextVisitWindow, VISIT_GAP_MS } from './visit-window';

describe('nextVisitWindow', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');

  it('keeps the first visit free of old activity', () => {
    expect(nextVisitWindow(null, null, now)).toBeNull();
  });

  it('preserves the window within an hour and opens a new one after a gap', () => {
    const previousWindow = new Date(now.getTime() - 2 * VISIT_GAP_MS);
    const recent = new Date(now.getTime() - VISIT_GAP_MS);
    const old = new Date(now.getTime() - VISIT_GAP_MS - 1);
    expect(nextVisitWindow(recent, previousWindow, now)).toEqual(
      previousWindow,
    );
    expect(nextVisitWindow(old, previousWindow, now)).toEqual(old);
  });
});
