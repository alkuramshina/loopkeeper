import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign, CampaignElementAccess } from '../../api/client';
import { Button } from '../../components/ui/button';
import { SegmentedControl } from '../../components/ui/segmented-control';
export type QuickNoteDraft = { text: string; access: CampaignElementAccess };
export const noteAccess: CampaignElementAccess[] = [
  'PRIVATE',
  'MASTER_ONLY',
  'SHARED',
];
export type NoteProfile = {
  accessOptions: CampaignElementAccess[];
  defaultAccess: CampaignElementAccess;
  showCharacter: boolean;
};
const ownerProfile: NoteProfile = {
  accessOptions: ['MASTER_ONLY', 'SHARED'],
  defaultAccess: 'MASTER_ONLY',
  showCharacter: false,
};
const playerProfile: NoteProfile = {
  accessOptions: noteAccess,
  defaultAccess: 'PRIVATE',
  showCharacter: true,
};
export function noteProfile(
  role?: Campaign['currentUserRole'],
): NoteProfile | null {
  return role === 'OWNER'
    ? ownerProfile
    : role === 'PLAYER'
      ? playerProfile
      : null;
}
export function emptyQuickNote(profile: NoteProfile): QuickNoteDraft {
  return { text: '', access: profile.defaultAccess };
}
export function noteAccessLabel(
  profile: NoteProfile,
  access: CampaignElementAccess,
) {
  return !profile.showCharacter && access === 'MASTER_ONLY'
    ? 'quickNote.onlyMe'
    : `ui.access.visibility.${access}`;
}
export function QuickNoteForm({
  draft,
  onDraft,
  profile,
  pending,
  error,
  onSubmit,
}: {
  draft: QuickNoteDraft;
  onDraft: (draft: QuickNoteDraft) => void;
  profile: NoteProfile;
  pending: boolean;
  error?: string;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <form
      className="quick-note"
      aria-label={t('case.quickNote.title')}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="quick-note-label" htmlFor={id}>
        {t('case.quickNote.title')}
      </label>
      <textarea
        className="quick-note-input"
        id={id}
        aria-describedby={`${id}-hint`}
        maxLength={10000}
        readOnly={pending}
        rows={4}
        value={draft.text}
        placeholder={t('case.quickNote.placeholder')}
        onChange={(event) => onDraft({ ...draft, text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <p className="visually-hidden" id={`${id}-hint`}>
        {t('case.quickNote.hint')}
      </p>
      <fieldset disabled={pending} className="quick-note-access">
        <legend>{t('elements.visibilityLabel')}</legend>
        <SegmentedControl
          label={t('elements.visibilityLabel')}
          value={draft.access}
          onChange={(access) => onDraft({ ...draft, access })}
          options={profile.accessOptions.map((access) => ({
            value: access,
            label: t(noteAccessLabel(profile, access)),
          }))}
        />
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="quick-note-footer">
        <Button
          disabled={pending || !draft.text.trim()}
          type="submit"
          variant="primary"
        >
          {t(pending ? 'quickNote.saving' : 'case.quickNote.save')}
        </Button>
      </div>
    </form>
  );
}
