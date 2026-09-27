import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { iconProps } from './icon';

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
};

/**
 * "More actions": rare actions stay out of the way but one press away.
 * Arrow keys move between items, Escape and Tab close the menu.
 */
export function MenuButton({
  label,
  items,
}: {
  label: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef<'first' | 'last' | null>(null);

  const menuItems = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );

  useEffect(() => {
    if (!open) return;
    const target = focusOnOpen.current;
    focusOnOpen.current = null;
    const all = menuItems();
    (target === 'last' ? all[all.length - 1] : all[0])?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = menuItems();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      event.preventDefault();
      all[(next + all.length) % all.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(all.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <div className="ui-menu" ref={rootRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="ui-icon-button"
        onClick={() => {
          focusOnOpen.current = 'first';
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first';
            setOpen(true);
          }
        }}
        ref={triggerRef}
        title={label}
        type="button"
      >
        <MoreHorizontal {...iconProps} size={18} />
      </button>
      {open && (
        <div
          aria-label={label}
          className="ui-menu-list"
          id={menuId}
          onKeyDown={onMenuKeyDown}
          role="menu"
        >
          {items.map(
            ({ label: itemLabel, onSelect, icon: Icon, danger, disabled }) => (
              <button
                className={
                  danger ? 'ui-menu-item ui-menu-item-danger' : 'ui-menu-item'
                }
                disabled={disabled}
                key={itemLabel}
                onClick={() => {
                  close(true);
                  onSelect();
                }}
                role="menuitem"
                tabIndex={-1}
                type="button"
              >
                {Icon && <Icon {...iconProps} />}
                {itemLabel}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
