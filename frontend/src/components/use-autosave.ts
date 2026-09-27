import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus =
  'saved' | 'pending' | 'saving' | 'invalid' | 'error';

/**
 * Saves `value` a moment after the last change, one request at a time.
 * Invalid drafts are kept locally and not sent; a failed save waits for the
 * next change or an explicit `flush()`, which resolves to whether everything
 * is saved.
 */
export function useAutosave<T>({
  value,
  valid,
  save,
  delay = 700,
}: {
  value: T;
  valid: boolean;
  save: (value: T) => Promise<unknown>;
  delay?: number;
}) {
  const serialized = JSON.stringify(value);
  const [savedAs, setSavedAs] = useState(serialized);
  const [request, setRequest] = useState<'idle' | 'saving' | 'error'>('idle');
  const latest = useRef({ value, serialized, valid, save });
  const savedRef = useRef(serialized);
  const inFlight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    latest.current = { value, serialized, valid, save };
  });

  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      await inFlight.current;
      return flush();
    }
    const current = latest.current;
    if (current.serialized === savedRef.current) return true;
    if (!current.valid) return false;
    setRequest('saving');
    const attempt = current
      .save(current.value)
      .then(
        () => {
          savedRef.current = current.serialized;
          setSavedAs(current.serialized);
          setRequest('idle');
          return true;
        },
        () => {
          setRequest('error');
          return false;
        },
      )
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = attempt;
    return attempt;
  }, []);

  useEffect(() => {
    if (!valid || serialized === savedAs) return;
    const timer = window.setTimeout(() => void flush(), delay);
    return () => window.clearTimeout(timer);
  }, [serialized, savedAs, valid, delay, flush]);

  // Leaving the editor keeps the last change instead of dropping it.
  useEffect(() => () => void flush(), [flush]);

  const dirty = serialized !== savedAs;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const status: AutosaveStatus =
    request === 'saving'
      ? 'saving'
      : request === 'error'
        ? 'error'
        : !dirty
          ? 'saved'
          : valid
            ? 'pending'
            : 'invalid';
  return { status, flush };
}
