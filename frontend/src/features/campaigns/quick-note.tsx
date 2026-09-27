import { FormEvent, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { CampaignElement, CampaignElementAccess } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { Button } from '../../components/ui/button';
import { iconProps } from '../../components/ui/icon';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { apiErrorText } from './element-model';
import { splitQuickNote } from './player-model';

export type QuickNoteDraft = { text: string; access: CampaignElementAccess };
export const emptyQuickNote: QuickNoteDraft = { text: '', access: 'PRIVATE' };

export const noteAccess: CampaignElementAccess[] = [
  'PRIVATE',
  'MASTER_ONLY',
  'SHARED',
];

/**
 * One field and "who will see it": the fastest way to write a thought down
 * during a scene. The draft belongs to the page, so switching between the
 * side column and the phone sheet keeps what was typed.
 */
export function QuickNoteForm({
  draft,
  onDraft,
  onSaved,
  autoFocus,
}: {
  draft: QuickNoteDraft;
  onDraft: (draft: QuickNoteDraft) => void;
  onSaved?: (note: CampaignElement) => void;
  autoFocus?: boolean;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = useId();
  const [saved, setSaved] = useState<CampaignElement>();
  const [error, setError] = useState<string>();
  const create = useMutation({
    mutationFn: (value: QuickNoteDraft) =>
      api.request<CampaignElement>(`/campaigns/${campaignId}/elements`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'NOTE',
          access: value.access,
          ...splitQuickNote(value.text),
        }),
      }),
    onSuccess: (note) => {
      queryClient.setQueryData(['element', note.elementId], note);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaignId],
      });
      setSaved(note);
      onDraft(emptyQuickNote);
      onSaved?.(note);
    },
    onError: (cause) => setError(apiErrorText(cause, t)),
  });
  const submit = () => {
    if (!draft.text.trim() || create.isPending) return;
    setError(undefined);
    create.mutate(draft);
  };

  return (
    <form
      aria-labelledby={`${id}-label`}
      className="quick-note"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="quick-note-label" htmlFor={id} id={`${id}-label`}>
        {t('case.quickNote.title')}
      </label>
      <textarea
        aria-describedby={`${id}-hint`}
        autoFocus={autoFocus}
        className="quick-note-input"
        id={id}
        maxLength={10000}
        onChange={(event) => {
          setSaved(undefined);
          onDraft({ ...draft, text: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={t('case.quickNote.placeholder')}
        rows={4}
        value={draft.text}
      />
      <p className="visually-hidden" id={`${id}-hint`}>
        {t('case.quickNote.hint')}
      </p>
      <div className="quick-note-access">
        <span aria-hidden="true">{t('elements.visibilityLabel')}</span>
        <SegmentedControl
          label={t('elements.visibilityLabel')}
          onChange={(access) => onDraft({ ...draft, access })}
          options={noteAccess.map((access) => ({
            value: access,
            label: t(`ui.access.visibility.${access}`),
          }))}
          value={draft.access}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="quick-note-footer">
        <Button
          disabled={!draft.text.trim() || create.isPending}
          type="submit"
          variant="primary"
        >
          {t('case.quickNote.save')}
        </Button>
        <span className="quick-note-status" role="status">
          {saved && (
            <>
              <Check {...iconProps} />
              {t('case.quickNote.saved')}{' '}
              <Link to={`/campaigns/${campaignId}/notes/${saved.elementId}`}>
                {t('case.quickNote.open')}
              </Link>
            </>
          )}
        </span>
      </div>
    </form>
  );
}
