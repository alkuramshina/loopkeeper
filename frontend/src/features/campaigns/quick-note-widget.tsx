import { characterSheet } from '../characters/tales-from-the-loop';
import { useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PencilLine, Pin, PinOff } from 'lucide-react';
import { Campaign, Character } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';
import { Button } from '../../components/ui/button';
import { QuickNoteForm } from './quick-note';
import { useQuickNote } from './quick-note-context';
import './player.css';
import './quick-note-widget.css';

export function useMyCharacter(campaignId: string, enabled = true) {
  const { api, profile } = useAuth();
  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () =>
      api.request<Character[]>(`/campaigns/${campaignId}/characters`),
    enabled,
    retry: false,
  });
  return characters.data?.find(
    (item) => item.isActive && item.ownerId === profile?.userId,
  );
}
function MyCharacter({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
  const character = useMyCharacter(campaign.campaignId);
  if (!character) return null;
  const conditions = (characterSheet(campaign.system)?.fields ?? []).filter(
    (field) =>
      field.section === 'conditions' &&
      field.type === 'boolean' &&
      character.data[field.key] === true,
  );
  return (
    <details className="quick-note-character">
      <summary>
        <span>{t('case.character.title')}</span>
        <strong>{character.name}</strong>
        {conditions.length > 0 && (
          <span>
            {conditions
              .map((field) =>
                t(`case.character.condition.${field.key}`, {
                  defaultValue: field.label,
                }),
              )
              .join(', ')}
          </span>
        )}
      </summary>
      {character.description && <p>{character.description}</p>}
      <Link
        to={`/campaigns/${campaign.campaignId}/characters/${character.characterId}`}
      >
        {t('quickNote.openCharacter')}
      </Link>
    </details>
  );
}
export function QuickNoteWidget({ campaign }: { campaign: Campaign }) {
  const note = useQuickNote();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!note?.open) return;
    const frame = requestAnimationFrame(() =>
      root.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [note?.open, note?.focusRequest]);
  if (!note?.profile) return null;
  const content = (
    <div data-quick-note ref={root} className="quick-note-body">
      <QuickNoteForm
        draft={note.draft}
        onDraft={note.setDraft}
        profile={note.profile}
        pending={note.pending}
        error={note.error}
        onSubmit={note.submit}
      />
      {note.profile.showCharacter && <MyCharacter campaign={campaign} />}
    </div>
  );
  return (
    <>
      {!note.open && (
        <Button
          data-quick-note-trigger
          aria-label={t('case.quickNote.title')}
          className={`quick-note-fab${pathname.endsWith('/board') ? ' quick-note-fab-board' : ''}`}
          icon={PencilLine}
          variant="primary"
          size="lg"
          onClick={note.openNote}
        />
      )}
      {note.open && (
        <ModalDialog
          sheet
          modal={note.mobile}
          title={t('case.quickNote.title')}
          onClose={note.close}
          onKeyDown={(event) => {
            if (
              event.key === 'Escape' &&
              !note.mobile &&
              !document.querySelector('dialog[aria-modal="true"][open]')
            ) {
              event.stopPropagation();
              note.close();
            }
          }}
          className={
            note.mobile
              ? undefined
              : `quick-note-panel${note.pinned ? ' quick-note-panel-pinned' : ''}`
          }
          headerActions={
            note.canPin && (
              <Button
                aria-label={t(
                  note.pinned ? 'quickNote.unpin' : 'quickNote.pin',
                )}
                aria-pressed={note.pinned}
                icon={note.pinned ? PinOff : Pin}
                onClick={note.togglePin}
              />
            )
          }
        >
          {content}
        </ModalDialog>
      )}
    </>
  );
}
