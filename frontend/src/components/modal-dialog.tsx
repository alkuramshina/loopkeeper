import { ReactNode, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type ModalDialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function ModalDialog({ title, children, onClose }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
      aria-labelledby={titleId}
      className="modal-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="modal-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          aria-label={t('common.close')}
          className="button-ghost"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
