import { MouseEvent, ReactNode, useEffect, useId, useRef } from 'react';
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
  children,
  onClose,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useTranslation();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      // The dialog is already detached on unmount, so the browser cannot
      // restore focus by itself; return it to the control that opened it.
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={[
        'modal-dialog',
        wide && 'modal-dialog-wide',
        sheet && 'modal-dialog-sheet',
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
        if (pressedOutside.current && isOutside(event)) onClose();
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
