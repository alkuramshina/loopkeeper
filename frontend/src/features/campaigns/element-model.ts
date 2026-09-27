import type { TFunction } from 'i18next';
import {
  ApiError,
  Board,
  CampaignElement,
  CampaignElementType,
} from '../../api/client';

/** Group order of the materials list: places first, then people, then text. */
export const elementTypes: CampaignElementType[] = [
  'LOCATION',
  'NPC',
  'NOTE',
  'OTHER',
];

export const npcFields = [
  'role',
  'motivation',
  'firstImpression',
  'secret',
  'relationship',
] as const;
export type NpcField = (typeof npcFields)[number];
export const npcLimits: Record<NpcField, number> = {
  role: 100,
  motivation: 500,
  firstImpression: 500,
  secret: 1000,
  relationship: 500,
};
// NPC details are stored as strings in the element's typeData.
export const npcText = (value: unknown) =>
  typeof value === 'string' ? value : '';

export const isUploadedMedia = (url: string | null | undefined) =>
  Boolean(url?.startsWith('/media/'));
export const isMapUrl = (url: string | null | undefined) =>
  Boolean(url && (/^https:\/\//i.test(url) || isUploadedMedia(url)));
export const isExternalMapUrl = (url: string) =>
  url === '' || /^https:\/\/\S+$/i.test(url);

// The map URL field edits only external links; an uploaded map file is
// managed by its own upload control.
export const externalMapUrl = (element: CampaignElement | undefined) =>
  element?.imageUrl && !isUploadedMedia(element.imageUrl)
    ? element.imageUrl
    : '';

export function apiErrorText(error: unknown, t: TFunction) {
  return error instanceof ApiError
    ? t(`errors.${error.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

/** "сегодня, 18:20", "вчера, 09:05" or "12 сентября, 18:20". */
export function formatChanged(iso: string, t: TFunction, now = new Date()) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('ru', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return t('elements.today', { time });
  if (days === 1) return t('elements.yesterday', { time });
  const day = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
  return t('elements.onDate', { date: day, time });
}

/** Cards that reference the element and the links that touch them. */
export function boardFootprint(board: Board, elementId: string) {
  const cardIds = new Set(
    board.cards
      .filter((card) => card.reference?.elementId === elementId)
      .map((card) => card.cardId),
  );
  const links = board.links.filter(
    (link) => cardIds.has(link.fromCardId) || cardIds.has(link.toCardId),
  ).length;
  return { cards: cardIds.size, links };
}
