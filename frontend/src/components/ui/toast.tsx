import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iconProps } from './icon';

type ToastInput = {
  message: string;
  /** Reverses the action; reversible actions ask no confirmation. */
  onUndo?: () => void;
};
type Toast = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Long enough to read and reach "Undo", short enough not to linger. */
export const toastDuration = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)),
    [],
  );
  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...toast, id }]);
  }, []);
  const { t } = useTranslation();

  return (
    <ToastContext.Provider value={show}>
      {children}
      <section
        aria-label={t('ui.notifications')}
        aria-live="polite"
        className="ui-toasts"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} onDismiss={dismiss} toast={toast} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);

  // Hover or keyboard focus keeps the toast, so "Undo" never escapes the user.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toastDuration);
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss, toast.id]);

  return (
    <div
      className="ui-toast"
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="status"
    >
      <p>{toast.message}</p>
      {toast.onUndo && (
        <button
          className="ui-toast-undo"
          onClick={() => {
            toast.onUndo?.();
            onDismiss(toast.id);
          }}
          type="button"
        >
          {t('ui.undo')}
        </button>
      )}
      <button
        aria-label={t('common.close')}
        className="ui-icon-button"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <X {...iconProps} />
      </button>
    </div>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast needs a ToastProvider');
  return useMemo(() => ({ show }), [show]);
}
