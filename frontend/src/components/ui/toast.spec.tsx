import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import '../../i18n';
import { ToastProvider, toastDuration, useToast } from './toast';

afterEach(() => vi.useRealTimers());
function Probe({ expire, undo }: { expire: () => void; undo: () => void }) {
  const toast = useToast();
  const location = useLocation();
  return (
    <>
      <output>{location.pathname}</output>
      <button
        onClick={() =>
          toast.show({
            message: 'Saved',
            action: { label: 'Open note', to: '/notes/created' },
            onExpire: expire,
            onUndo: undo,
          })
        }
      >
        Notify
      </button>
    </>
  );
}
function setup() {
  const expire = vi.fn();
  const undo = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <Probe expire={expire} undo={undo} />
      </ToastProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
  return { expire, undo };
}
it('navigates with an action link and holds the toast while it has keyboard focus', () => {
  vi.useFakeTimers();
  const { expire } = setup();
  const link = screen.getByRole('link', { name: 'Open note' });
  fireEvent.focus(link);
  void act(() => vi.advanceTimersByTime(toastDuration * 2));
  expect(expire).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(screen.getByText('Saved').closest('.ui-toast')).toBeInTheDocument();
  expect(screen.getByText('/notes/created')).toBeInTheDocument();
  fireEvent.blur(link);
  void act(() => vi.advanceTimersByTime(toastDuration));
  expect(expire).toHaveBeenCalledOnce();
});
it('preserves undo and commits a pending action only when the toast is dismissed or expires', () => {
  const { expire, undo } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  expect(undo).toHaveBeenCalledOnce();
  expect(expire).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(expire).toHaveBeenCalledOnce();
});
