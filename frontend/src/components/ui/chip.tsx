import { ReactNode } from 'react';

/** A quiet label: tags, counts, small facts. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="ui-chip">{children}</span>;
}

/** A chip that switches something on and off, e.g. a character condition. */
export function ToggleChip({
  pressed,
  onToggle,
  disabled,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-pressed={pressed}
      className="ui-chip ui-toggle-chip"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {children}
    </button>
  );
}
