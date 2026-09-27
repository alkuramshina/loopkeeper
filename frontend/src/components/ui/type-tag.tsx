import { Archive, FileText, MapPin, Pencil, Shield, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iconProps } from './icon';

export type TagType =
  'LOCATION' | 'NPC' | 'NOTE' | 'OTHER' | 'CHARACTER' | 'FREE';

const icons = {
  LOCATION: MapPin,
  NPC: Shield,
  NOTE: FileText,
  OTHER: Archive,
  CHARACTER: User,
  FREE: Pencil,
} as const;

/** Type of a material or board card: shape and icon, never colour alone. */
export function TypeTag({ type }: { type: TagType }) {
  const { t } = useTranslation();
  const Icon = icons[type];
  const label =
    type === 'CHARACTER' || type === 'FREE'
      ? t(`ui.cardTypes.${type}`)
      : t(`elements.types.${type}`);
  return (
    <span className="ui-type-tag">
      <Icon {...iconProps} size={14} />
      {label}
    </span>
  );
}
