import { useTranslation } from 'react-i18next';

/** Soft "new" mark: a dot and a word, never a counter. */
export function NewMark({ children }: { children?: string }) {
  const { t } = useTranslation();
  return <span className="ui-new-mark">{children ?? t('ui.newMark')}</span>;
}
