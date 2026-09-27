export const VISIT_GAP_MS = 60 * 60 * 1000;

export function nextVisitWindow(
  lastVisitAt: Date | null,
  newSinceAt: Date | null,
  now: Date,
): Date | null {
  return lastVisitAt && now.getTime() - lastVisitAt.getTime() > VISIT_GAP_MS
    ? lastVisitAt
    : newSinceAt;
}
