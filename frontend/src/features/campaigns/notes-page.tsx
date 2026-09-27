import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Heading2,
  LayoutDashboard,
  List,
  Plus,
  Trash2,
} from 'lucide-react';
import { ApiError, Campaign, CampaignElement } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { MediaUpload } from '../../components/media-upload';
import { PageError } from '../../components/page-error';
import { ProtectedImage } from '../../components/protected-image';
import { AutosaveStatus, useAutosave } from '../../components/use-autosave';
import { AccessBadge } from '../../components/ui/access-badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { iconProps } from '../../components/ui/icon';
import { MenuButton } from '../../components/ui/menu-button';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { Skeleton } from '../../components/ui/skeleton';
import { useToast } from '../../components/ui/toast';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { apiErrorText } from './element-model';
import {
  MarkdownAction,
  applyMarkdown,
  ownNotes,
  plainExcerpt,
  titleLimit,
} from './player-model';
import { noteAccess } from './quick-note';
import { useAccessChange, useAddToBoard } from './use-element-actions';
import './materials.css';
import './player.css';

type Draft = { title: string; content: string };

const timeFormat = new Intl.DateTimeFormat('ru', {
  hour: '2-digit',
  minute: '2-digit',
});

function SaveStatus({
  status,
  savedAt,
  onRetry,
}: {
  status: AutosaveStatus;
  savedAt: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="material-save-status" role="status">
      {status === 'saved'
        ? t('notes.savedAt', { time: timeFormat.format(new Date(savedAt)) })
        : status === 'invalid'
          ? t('elements.autosave.invalid')
          : status === 'error'
            ? t('elements.autosave.error')
            : t('elements.autosave.saving')}
      {status === 'error' && (
        <button
          className="material-link-button"
          onClick={onRetry}
          type="button"
        >
          {t('common.retry')}
        </button>
      )}
    </span>
  );
}

const formatting: { action: MarkdownAction; key?: string }[] = [
  { action: 'bold', key: 'b' },
  { action: 'italic', key: 'i' },
  { action: 'list' },
  { action: 'heading' },
];

function NoteEditor({
  note,
  focusTitle,
  onDelete,
}: {
  note: CampaignElement;
  focusTitle: boolean;
  onDelete: (note: CampaignElement) => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>({
    title: note.title,
    content: note.content ?? '',
  });
  const valid = Boolean(draft.title.trim());
  const { status, flush } = useAutosave({
    value: draft,
    valid,
    save: async (value: Draft) => {
      const saved = await api.request<CampaignElement>(
        `/elements/${note.elementId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: value.title.trim(),
            content: value.content,
          }),
        },
      );
      queryClient.setQueryData(['element', note.elementId], saved);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaignId],
      });
    },
  });
  const access = useAccessChange({
    element: note,
    owner: false,
    beforeChange: flush,
  });
  const addToBoard = useAddToBoard(note.elementId);

  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [focusTitle]);

  const format = (action: MarkdownAction) => {
    const area = textRef.current;
    if (!area) return;
    const next = applyMarkdown(
      draft.content,
      area.selectionStart,
      area.selectionEnd,
      action,
    );
    setDraft({ ...draft, content: next.text });
    // Put the caret back once React has written the new text.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(next.start, next.end);
    });
  };

  return (
    <article aria-label={note.title} className="note-editor">
      <header className="note-editor-bar">
        <Link className="material-back" to={`/campaigns/${campaignId}/notes`}>
          <ArrowLeft {...iconProps} />
          {t('notes.backToNotes')}
        </Link>
        <SaveStatus
          onRetry={() => void flush()}
          savedAt={note.updatedAt}
          status={status}
        />
        <span className="note-editor-actions">
          {note.access === 'SHARED' && (
            <Button
              disabled={addToBoard.isPending}
              icon={LayoutDashboard}
              onClick={() => addToBoard.mutate()}
            >
              {t('elements.addToBoard')}
            </Button>
          )}
          <MenuButton
            items={[
              {
                label: t('elements.delete'),
                icon: Trash2,
                danger: true,
                onSelect: () => onDelete(note),
              },
            ]}
            label={t('elements.moreActions')}
          />
        </span>
      </header>
      <div className="note-editor-scroll">
        <div className="note-editor-document">
          <div className="note-title-field">
            <label htmlFor={`${id}-title`}>{t('elements.name')}</label>
            <input
              aria-describedby={valid ? undefined : `${id}-title-error`}
              aria-invalid={valid ? undefined : true}
              className="note-title-input"
              id={`${id}-title`}
              maxLength={titleLimit}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              ref={titleRef}
              value={draft.title}
            />
            {!valid && (
              <p className="ui-field-error" id={`${id}-title-error`}>
                {t('elements.titleRequired')}
              </p>
            )}
          </div>
          <div className="note-visibility">
            <span aria-hidden="true" className="note-visibility-label">
              {t('notes.whoSees')}
            </span>
            <SegmentedControl
              label={t('notes.whoSees')}
              onChange={access.request}
              options={noteAccess.map((item) => ({
                value: item,
                label: t(`ui.access.visibility.${item}`),
              }))}
              value={note.access}
            />
            <span className="note-visibility-hint">
              {t(`notes.visibilityHint.${note.access}`)}
            </span>
          </div>
          <div
            aria-label={t('notes.formatting')}
            className="note-format-bar"
            role="toolbar"
          >
            {formatting.map(({ action }) => (
              <button
                aria-label={t(`notes.format.${action}`)}
                className={`ui-icon-button note-format-${action}`}
                key={action}
                // Keep the selection in the text while pressing the button.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => format(action)}
                title={t(`notes.format.${action}`)}
                type="button"
              >
                {action === 'bold' ? (
                  <span aria-hidden="true">{t('notes.formatGlyph.bold')}</span>
                ) : action === 'italic' ? (
                  <span aria-hidden="true">
                    {t('notes.formatGlyph.italic')}
                  </span>
                ) : action === 'list' ? (
                  <List {...iconProps} />
                ) : (
                  <Heading2 {...iconProps} />
                )}
              </button>
            ))}
          </div>
          <label className="visually-hidden" htmlFor={`${id}-text`}>
            {t('elements.content')}
          </label>
          <textarea
            className="note-text-input"
            id={`${id}-text`}
            maxLength={10000}
            onChange={(event) =>
              setDraft({ ...draft, content: event.target.value })
            }
            onKeyDown={(event) => {
              if (!(event.ctrlKey || event.metaKey)) return;
              const shortcut = formatting.find(
                (item) => item.key === event.key.toLowerCase(),
              );
              if (!shortcut) return;
              event.preventDefault();
              format(shortcut.action);
            }}
            placeholder={t('notes.textPlaceholder')}
            ref={textRef}
            value={draft.content}
          />
          <section aria-label={t('elements.images')} className="note-cover">
            {note.coverUrl && (
              <figure className="material-figure">
                <ProtectedImage
                  alt=""
                  className="element-cover"
                  imageUrl={note.coverUrl}
                />
              </figure>
            )}
            <MediaUpload
              endpoint={`/elements/${note.elementId}/cover`}
              hasImage={Boolean(note.coverUrl)}
              label={t('elements.cover')}
              onChanged={() =>
                queryClient.invalidateQueries({
                  queryKey: ['element', note.elementId],
                })
              }
            />
            <p className="muted">{t('elements.coverHint')}</p>
          </section>
        </div>
      </div>
      {access.dialogs}
    </article>
  );
}

export function NotesPage() {
  const { campaignId, elementId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const listPath = `/campaigns/${campaignId}/notes`;
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const role = campaign.data?.currentUserRole;
  const elements = useQuery({
    queryKey: ['elements', campaignId],
    queryFn: () =>
      api.request<CampaignElement[]>(`/campaigns/${campaignId}/elements`),
    enabled: role === 'PLAYER',
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['element', elementId],
    queryFn: () => api.request<CampaignElement>(`/elements/${elementId}`),
    enabled: Boolean(elementId) && role === 'PLAYER',
    retry: false,
  });
  const notes = useMemo(
    () =>
      ownNotes(elements.data ?? [], profile?.userId).filter(
        (note) => !pendingDeletes.includes(note.elementId),
      ),
    [elements.data, profile?.userId, pendingDeletes],
  );

  const create = useMutation({
    mutationFn: () =>
      api.request<CampaignElement>(`/campaigns/${campaignId}/elements`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'NOTE',
          title: t('notes.untitled'),
          content: '',
          access: 'PRIVATE',
        }),
      }),
    onSuccess: (note) => {
      queryClient.setQueryData(['element', note.elementId], note);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaignId],
      });
      void navigate(`${listPath}/${note.elementId}`, {
        state: { focusTitle: true },
      });
    },
    onError: (cause) => toast.show({ message: apiErrorText(cause, t) }),
  });

  // Deleting waits for the notification to expire, so "Undo" costs nothing.
  const scheduleDelete = (note: CampaignElement) => {
    const id = note.elementId;
    setPendingDeletes((current) => [...current, id]);
    void navigate(listPath);
    const restore = () =>
      setPendingDeletes((current) => current.filter((item) => item !== id));
    toast.show({
      message: t('elements.deleted', { title: note.title }),
      onUndo: restore,
      onExpire: () => {
        void api
          .request<void>(`/elements/${id}`, { method: 'DELETE' })
          .then(async () => {
            queryClient.removeQueries({ queryKey: ['element', id] });
            await queryClient.invalidateQueries({
              queryKey: ['elements', campaignId],
            });
            void queryClient.invalidateQueries({
              queryKey: ['board', campaignId],
            });
          })
          .catch((cause) => toast.show({ message: apiErrorText(cause, t) }))
          .finally(restore);
      },
    });
  };

  const detailMissing =
    detail.error instanceof ApiError && detail.error.status === 404;
  if (
    campaign.isError ||
    elements.isError ||
    (detail.isError && !detailMissing)
  )
    return (
      <PageError
        error={campaign.error ?? elements.error ?? detail.error ?? undefined}
        onRetry={() => {
          void campaign.refetch();
          void elements.refetch();
          void detail.refetch();
        }}
      />
    );
  // Only a player writes notes; the master has the materials, a viewer the case.
  const keep = elementId ? `/${elementId}` : '';
  if (role === 'OWNER')
    return <Navigate replace to={`/campaigns/${campaignId}/elements${keep}`} />;
  if (role === 'VIEWER')
    return <Navigate replace to={`/campaigns/${campaignId}/case${keep}`} />;

  const loaded =
    detail.data?.campaignId === campaignId ? detail.data : undefined;
  // Somebody else's shared note is read in the case, not edited here.
  if (loaded && loaded.createdById !== profile?.userId)
    return (
      <Navigate
        replace
        to={`/campaigns/${campaignId}/case/${loaded.elementId}`}
      />
    );
  const selected =
    loaded && !pendingDeletes.includes(loaded.elementId) ? loaded : undefined;
  const unavailable =
    Boolean(elementId) &&
    (detailMissing ||
      pendingDeletes.includes(elementId ?? '') ||
      (detail.data !== undefined && !loaded));
  const loading = campaign.isLoading || elements.isLoading;
  const newNote = (
    <Button
      disabled={create.isPending}
      icon={Plus}
      onClick={() => create.mutate()}
      variant="primary"
    >
      {t('elements.newNote')}
    </Button>
  );

  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      <div
        className={`materials-layout notes-layout ${elementId ? 'materials-layout-detail' : ''}`}
      >
        <section
          aria-labelledby="notes-title"
          className="materials-list-pane notes-list-pane"
        >
          <div className="materials-heading notes-heading">
            <h1 id="notes-title">{t('notes.title')}</h1>
            {!loading && notes.length > 0 && newNote}
          </div>
          <nav
            aria-busy={loading}
            aria-label={t('notes.listLabel')}
            className="notes-list"
          >
            {loading && (
              <div className="materials-skeleton">
                <span className="visually-hidden">{t('common.loading')}</span>
                {[0, 1, 2].map((row) => (
                  <Skeleton height="4rem" key={row} />
                ))}
              </div>
            )}
            {notes.length > 0 && (
              <ul>
                {notes.map((note) => (
                  <li key={note.elementId}>
                    <Link
                      aria-current={
                        note.elementId === elementId ? 'page' : undefined
                      }
                      className="note-row"
                      to={`${listPath}/${note.elementId}`}
                    >
                      <span className="note-row-head">
                        <span className="note-row-title">{note.title}</span>
                        <AccessBadge
                          access={note.access}
                          variant="visibility"
                        />
                      </span>
                      {plainExcerpt(note.content) && (
                        <span className="note-row-excerpt">
                          {plainExcerpt(note.content)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>
          {!loading && notes.length === 0 && (
            <EmptyState action={newNote} title={t('notes.empty')}>
              <p>{t('notes.emptyText')}</p>
            </EmptyState>
          )}
        </section>
        <section className="materials-detail-pane notes-detail-pane">
          {selected ? (
            <NoteEditor
              focusTitle={Boolean(
                (location.state as { focusTitle?: boolean } | null)?.focusTitle,
              )}
              key={selected.elementId}
              note={selected}
              onDelete={scheduleDelete}
            />
          ) : unavailable ? (
            <EmptyState title={t('elements.unavailable')}>
              <p>{t('elements.unavailableText')}</p>
              <Link to={listPath}>{t('notes.backToNotes')}</Link>
            </EmptyState>
          ) : elementId ? (
            <div aria-busy="true" className="material-document">
              <Skeleton width="60%" height="2.5rem" />
              <Skeleton height="3.5rem" />
              <Skeleton height="10rem" />
            </div>
          ) : (
            notes.length > 0 && (
              <p className="materials-select">{t('notes.select')}</p>
            )
          )}
        </section>
      </div>
    </CampaignWorkspaceShell>
  );
}
