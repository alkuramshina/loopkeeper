import {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { iconProps } from './ui/icon';

type ModalDialogProps = {
  title: string;
  /** One quiet line under the title. */
  description?: string;
  /** Room for a side-by-side layout, e.g. a preview next to its details. */
  wide?: boolean;
  /** On a phone, a sheet along the bottom edge instead of a centred box. */
  sheet?: boolean;
  /** A persistent auxiliary region can become modal on a phone. */
  modal?: boolean;
  className?: string;
  headerActions?: ReactNode;
  onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>) => void;
  children: ReactNode;
  onClose: () => void;
};

// Backdrop clicks target the dialog element itself, outside its box.
function isOutside(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const box = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

export function ModalDialog({
  title,
  description,
  wide,
  sheet,
  modal = true,
  className,
  headerActions,
  onKeyDown,
  children,
  onClose,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const opener = useRef<HTMLElement | null>(null);
  const modeFocus = useRef<HTMLElement | null>(null);
  const { t } = useTranslation();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const active =
      modeFocus.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    modeFocus.current = null;
    if (!opener.current) opener.current = active;
    if (modal) dialog.showModal();
    else dialog.show();
    // Changing presentation keeps the same controls and their focus.
    if (active?.isConnected && (dialog.contains(active) || !modal))
      active.focus();
    return () => {
      modeFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (dialog.open) dialog.close();
    };
  }, [modal]);
  useEffect(
    () => () => {
      // The dialog is already detached on unmount, so the browser cannot
      // restore focus by itself; return it to the control that opened it.
      if (opener.current?.isConnected) opener.current.focus();
    },
    [],
  );

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal={modal ? true : undefined}
      role={modal ? 'dialog' : 'region'}
      onKeyDown={onKeyDown}
      className={[
        'modal-dialog',
        wide && 'modal-dialog-wide',
        sheet && 'modal-dialog-sheet',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A press that starts and ends on the backdrop closes the dialog; a text
      // selection dragged out of the form does not.
      onPointerDown={(event) => {
        pressedOutside.current = isOutside(event);
      }}
      onClick={(event) => {
        if (modal && pressedOutside.current && isOutside(event)) onClose();
        pressedOutside.current = false;
      }}
      ref={dialogRef}
    >
      <div className="modal-dialog-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && (
            <p className="modal-dialog-description" id={descriptionId}>
              {description}
            </p>
          )}
        </div>
        {headerActions}
        <button
          aria-label={t('common.close')}
          className="ui-icon-button"
          onClick={onClose}
          type="button"
        >
          <X {...iconProps} size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
