import { FormEvent, Fragment, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign, Note, NoteVisibility } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

type EditorTarget = Note | 'new';

const visibilityByRole: Record<Campaign['currentUserRole'], NoteVisibility[]> =
  {
    OWNER: ['PRIVATE', 'MASTER_ONLY', 'PLAYERS', 'PUBLIC'],
    PLAYER: ['PRIVATE', 'PLAYERS', 'PUBLIC'],
    VIEWER: [],
  };

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function canManage(
  note: Note,
  profileId: string | undefined,
  role: Campaign['currentUserRole'],
) {
  return role === 'OWNER' || note.authorId === profileId;
}

function InlineMarkdown({ content }: { content: string }) {
  const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n');
  const result: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length) {
      result.push(
        <ul key={`list-${result.length}`}>
          {list.map((item, index) => (
            <li key={index}>
              <InlineMarkdown content={item} />
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line, index) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item) {
      list.push(item[1]);
      return;
    }
    flushList();
    if (heading) {
      const level = heading[1].length;
      const text = <InlineMarkdown content={heading[2]} />;
      result.push(
        level === 1 ? (
          <h1 key={index}>{text}</h1>
        ) : level === 2 ? (
          <h2 key={index}>{text}</h2>
        ) : (
          <h3 key={index}>{text}</h3>
        ),
      );
    } else if (line) {
      result.push(
        <p key={index}>
          <InlineMarkdown content={line} />
        </p>,
      );
    }
  });
  flushList();
  return <div className="markdown-preview">{result}</div>;
}

function NoteEditor({
  note,
  role,
  onClose,
}: {
  note: EditorTarget;
  role: Campaign['currentUserRole'];
  onClose: () => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const existing = note === 'new' ? undefined : note;
  const [content, setContent] = useState(existing?.content ?? '');
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = {
        title: String(form.get('title') ?? ''),
        content: String(form.get('content') ?? ''),
        visibility: String(form.get('visibility')) as NoteVisibility,
      };
      return existing
        ? api.request<Note>(`/notes/${existing.noteId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : api.request<Note>(`/campaigns/${campaignId}/notes`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes', campaignId] });
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  return (
    <section className="panel note-editor">
      <div className="section-heading">
        <div>
          <p className="kicker">{t('workspace.notes')}</p>
          <h2>{t(existing ? 'notes.edit' : 'notes.new')}</h2>
        </div>
        <button className="button-ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
      <form onSubmit={(event) => save.mutate(event)}>
        <label>
          {t('notes.title')}
          <input
            name="title"
            defaultValue={existing?.title}
            maxLength={200}
            required
          />
        </label>
        <label>
          {t('notes.visibility')}
          <select
            name="visibility"
            defaultValue={existing?.visibility ?? 'PRIVATE'}
          >
            {visibilityByRole[role].map((visibility) => (
              <option key={visibility} value={visibility}>
                {t(`notes.visibilities.${visibility}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('notes.content')}
          <textarea
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={10000}
            required
          />
        </label>
        <div className="preview-panel">
          <p className="kicker">{t('notes.preview')}</p>
          {content ? (
            <MarkdownPreview content={content} />
          ) : (
            <p className="muted">{t('notes.previewEmpty')}</p>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={save.isPending}>
          {t(existing ? 'common.save' : 'notes.create')}
        </button>
      </form>
    </section>
  );
}

export function NotesPage() {
  const { campaignId } = useParams();
  const { api, profile, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorTarget>();
  const [error, setError] = useState<string>();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const notes = useQuery({
    queryKey: ['notes', campaignId],
    queryFn: () => api.request<Note[]>(`/campaigns/${campaignId}/notes`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: (noteId: string) =>
      api.request<void>(`/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes', campaignId] });
      setSelectedId(undefined);
      setError(undefined);
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const addToBoard = useMutation({
    mutationFn: (noteId: string) =>
      api.request(`/campaigns/${campaignId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cardKind: 'NOTE_REFERENCE', noteId }),
      }),
    onSuccess: () => {
      setError(undefined);
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language);
    if (!query) return notes.data;
    return notes.data?.filter((note) =>
      `${note.title} ${note.content}`
        .toLocaleLowerCase(i18n.language)
        .includes(query),
    );
  }, [i18n.language, notes.data, search]);
  const selected = useMemo(
    () =>
      visibleNotes?.find((note) => note.noteId === selectedId) ??
      visibleNotes?.[0],
    [selectedId, visibleNotes],
  );
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
  });

  if (campaign.isError || notes.isError) {
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  }

  const data = campaign.data;
  const role = data?.currentUserRole ?? 'VIEWER';
  const basePath = `/campaigns/${campaignId}`;
  const editable = selected && canManage(selected, profile?.userId, role);
  const shareable =
    selected &&
    ['PLAYERS', 'PUBLIC'].includes(selected.visibility) &&
    role !== 'VIEWER';

  return (
    <CampaignWorkspaceShell campaign={data}>
      <section className="page-header note-page-header">
        <div>
          <p className="kicker">{t('workspace.notes')}</p>
          <h2>{t('notes.title')}</h2>
        </div>
        {role !== 'VIEWER' && (
          <button onClick={() => setEditor('new')}>{t('notes.new')}</button>
        )}
      </section>
      {editor && (
        <NoteEditor
          note={editor}
          role={role}
          onClose={() => setEditor(undefined)}
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notes.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : notes.data?.length ? (
        <section className="notes-layout">
          <div className="note-list" aria-label={t('notes.title')}>
            <label className="note-search">
              <span className="visually-hidden">{t('notes.search')}</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('notes.search')}
                type="search"
                value={search}
              />
            </label>
            {visibleNotes?.map((note) => (
              <button
                className={`note-list-item ${selected?.noteId === note.noteId ? 'selected' : ''}`}
                key={note.noteId}
                onClick={() => setSelectedId(note.noteId)}
                type="button"
              >
                <strong>{note.title}</strong>
                <small className="note-list-excerpt">{note.content}</small>
                <span className="note-list-meta">
                  <small>{dateFormat.format(new Date(note.updatedAt))}</small>
                  <small
                    className={`visibility-badge visibility-${note.visibility.toLowerCase()}`}
                  >
                    {t(`notes.visibilities.${note.visibility}`)}
                  </small>
                </span>
              </button>
            ))}
            {visibleNotes?.length === 0 && (
              <p className="note-list-empty">{t('notes.noSearchResults')}</p>
            )}
          </div>
          {selected && (
            <article className="panel note-detail">
              <div className="section-heading">
                <div>
                  <p
                    className={`visibility-badge visibility-${selected.visibility.toLowerCase()}`}
                  >
                    {t(`notes.visibilities.${selected.visibility}`)}
                  </p>
                  <h2>{selected.title}</h2>
                </div>
                <div className="action-row">
                  {shareable && (
                    <button
                      className="button-ghost"
                      onClick={() => addToBoard.mutate(selected.noteId)}
                    >
                      {t('notes.addToBoard')}
                    </button>
                  )}
                  {editable && (
                    <button
                      className="button-ghost"
                      onClick={() => setEditor(selected)}
                    >
                      {t('common.edit')}
                    </button>
                  )}
                  {editable && (
                    <button
                      className="button-danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            t('notes.deleteConfirmation', {
                              title: selected.title,
                            }),
                          )
                        )
                          remove.mutate(selected.noteId);
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
              <MarkdownPreview content={selected.content} />
            </article>
          )}
        </section>
      ) : (
        <section className="panel empty-state">
          <p>{t('notes.empty')}</p>
        </section>
      )}
    </CampaignWorkspaceShell>
  );
}
