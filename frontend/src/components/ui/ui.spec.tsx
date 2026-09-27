import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { Logo, LogoMark } from '../brand/logo';
import { AccessBadge } from './access-badge';
import { ToggleChip } from './chip';
import { SegmentedControl } from './segmented-control';
import { TextField } from './text-field';
import { toastDuration, ToastProvider, useToast } from './toast';
import { TypeTag } from './type-tag';

describe('AccessBadge', () => {
  it('names the status in words for the master', () => {
    render(
      <>
        <AccessBadge access="SHARED" />
        <AccessBadge access="MASTER_ONLY" />
        <AccessBadge access="PRIVATE" />
      </>,
    );
    for (const word of ['Открыто', 'Скрыто', 'Личное']) {
      const badge = screen.getByText(word);
      // The icon is decorative; the word carries the meaning.
      expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('speaks as the note author with the visibility variant', () => {
    render(<AccessBadge access="MASTER_ONLY" variant="visibility" />);
    expect(screen.getByText('Мастеру')).toBeInTheDocument();
  });
});

describe('TypeTag', () => {
  it('labels element and card types', () => {
    render(
      <>
        <TypeTag type="LOCATION" />
        <TypeTag type="FREE" />
      </>,
    );
    expect(screen.getByText('Локация')).toBeInTheDocument();
    expect(screen.getByText('Своя мысль')).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  it('is a named radio group that reports the chosen value', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Фильтр"
        onChange={onChange}
        options={[
          { value: 'all', label: 'Все', count: 13 },
          { value: 'shared', label: 'Открыто', count: 5 },
        ]}
        value="all"
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Фильтр' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Все/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Открыто/ }));
    expect(onChange).toHaveBeenCalledWith('shared');
  });
});

describe('ToggleChip', () => {
  it('exposes its state as pressed', () => {
    const onToggle = vi.fn();
    render(
      <ToggleChip onToggle={onToggle} pressed>
        Напугана
      </ToggleChip>,
    );
    const chip = screen.getByRole('button', { name: 'Напугана' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip);
    expect(onToggle).toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('describes the input with its hint and error', () => {
    render(
      <TextField error="Проверьте почту" hint="Рабочая почта" label="Почта" />,
    );
    const input = screen.getByLabelText('Почта');
    expect(input).toHaveAccessibleDescription('Рабочая почта Проверьте почту');
    expect(input).toBeInvalid();
  });
});

describe('Logo', () => {
  it('is an image named Loopkeeper, or decorative without a label', () => {
    const { container } = render(
      <>
        <Logo label="Loopkeeper" />
        <LogoMark />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Loopkeeper' })).toBeInTheDocument();
    expect(container.querySelector('.logo-mark')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function Trigger({ onUndo }: { onUndo: () => void }) {
    const toast = useToast();
    return (
      <button
        onClick={() => toast.show({ message: 'Карточка убрана', onUndo })}
        type="button"
      >
        Убрать
      </button>
    );
  }

  it('offers undo instead of a confirmation and then disappears', () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(screen.getByRole('status')).toHaveTextContent('Карточка убрана');
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses itself after a while, but not while hovered', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger onUndo={vi.fn()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    const toast = screen.getByRole('status');
    fireEvent.mouseEnter(toast);
    await act(() => vi.advanceTimersByTimeAsync(toastDuration * 2));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    await act(() => vi.advanceTimersByTimeAsync(toastDuration));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
