import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iconProps } from './icon';

export type Access = 'SHARED' | 'MASTER_ONLY' | 'PRIVATE';

const icons = {
  status: { SHARED: Eye, MASTER_ONLY: EyeOff, PRIVATE: Lock },
  visibility: { SHARED: Eye, MASTER_ONLY: UserRound, PRIVATE: Lock },
} as const;

/**
 * Access status, always as icon + word; the colours are reserved for it.
 * `status` speaks for the master ("Открыто / Скрыто"), `visibility` for the
 * author of a note ("Всем / Мастеру / Личное").
 */
export function AccessBadge({
  access,
  variant = 'status',
}: {
  access: Access;
  variant?: 'status' | 'visibility';
}) {
  const { t } = useTranslation();
  const Icon = icons[variant][access];
  return (
    <span className={`ui-access ui-access-${access.toLowerCase()}`}>
      <Icon {...iconProps} size={14} />
      {t(`ui.access.${variant}.${access}`)}
    </span>
  );
}
