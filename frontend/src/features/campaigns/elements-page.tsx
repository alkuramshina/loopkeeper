import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import {
  ApiError,
  Campaign,
  CampaignElement,
  CampaignElementInput,
  CampaignElementType,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { ElementMapViewer } from './element-map-viewer';

function SafeMarkdown({ content }: { content: string | null | undefined }) {
  return (
    <ReactMarkdown
      urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
      components={{
        img: () => null,
        a: ({ children, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const types: CampaignElementType[] = ['NOTE', 'LOCATION', 'NPC', 'OTHER'];
type Draft = Omit<CampaignElementInput, 'content'> & { content: string };
const npcFields = [
  'role',
  'motivation',
  'firstImpression',
  'secret',
  'relationship',
] as const;
const npcLimits = {
  role: 100,
  motivation: 500,
  firstImpression: 500,
  secret: 1000,
  relationship: 500,
};

function draftFor(
  element?: CampaignElement,
  type: CampaignElementType = 'NOTE',
): Draft {
  return {
    type: element?.type ?? type,
    access: element?.access ?? 'MASTER_ONLY',
    title: element?.title ?? '',
    content: element?.content ?? '',
    imageUrl: element?.imageUrl ?? '',
    typeData: element?.typeData ?? {},
  };
}

function message(
  error: unknown,
  t: (key: string, options?: { defaultValue: string }) => string,
) {
  return error instanceof ApiError
    ? t(`errors.${error.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function ElementEditor({
  element,
  initialType,
  onClose,
  onSaved,
}: {
  element?: CampaignElement;
  initialType: CampaignElementType;
  onClose: () => void;
  onSaved: (element: CampaignElement) => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => draftFor(element, initialType));
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        type: draft.type,
        title: draft.title.trim(),
        content: draft.content,
        ...(element ? {} : { access: 'MASTER_ONLY' }),
        ...(draft.type === 'LOCATION'
          ? { imageUrl: draft.imageUrl || (element ? null : undefined) }
          : {}),
        ...(draft.type === 'NPC' ? { typeData: draft.typeData } : {}),
      };
      return api.request<CampaignElement>(
        element
          ? `/elements/${element.elementId}`
          : `/campaigns/${campaignId}/elements`,
        { method: element ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
    },
    onSuccess: onSaved,
    onError: (cause) => setError(message(cause, t)),
  });
  const updateNpc = (field: string, value: string) =>
    setDraft((current) => ({
      ...current,
      typeData: { ...current.typeData, [field]: value },
    }));

  return (
    <ModalDialog
      title={t(element ? 'elements.edit' : 'elements.new')}
      onClose={onClose}
    >
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label>
          {t('elements.type')}
          <select
            value={draft.type}
            disabled={Boolean(element)}
            onChange={(event) =>
              setDraft(
                draftFor(undefined, event.target.value as CampaignElementType),
              )
            }
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {t(`elements.types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('elements.name')}
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
            required
            maxLength={200}
          />
        </label>
        <label>
          {t('elements.content')}
          <textarea
            value={draft.content}
            onChange={(event) =>
              setDraft({ ...draft, content: event.target.value })
            }
            maxLength={10000}
          />
        </label>
        {draft.type === 'LOCATION' && (
          <label>
            {t('elements.mapUrl')}
            <input
              type="url"
              pattern="https://.*"
              placeholder="https://"
              maxLength={2048}
              value={draft.imageUrl ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, imageUrl: event.target.value })
              }
            />
          </label>
        )}
        {draft.type === 'NPC' &&
          npcFields.map((field) => (
            <label key={field}>
              {t(`elements.npc.${field}`)}
              <input
                required={field === 'role'}
                maxLength={npcLimits[field]}
                value={String(draft.typeData?.[field] ?? '')}
                onChange={(event) => updateNpc(field, event.target.value)}
              />
            </label>
          ))}
        <div className="preview-panel">
          <p className="kicker">{t('elements.preview')}</p>
          <div className="markdown-preview">
            <SafeMarkdown content={draft.content} />
          </div>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button disabled={save.isPending}>{t('common.save')}</button>
      </form>
    </ModalDialog>
  );
}

export function ElementsPage() {
  const { campaignId, elementId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<CampaignElement | 'new'>();
  const [error, setError] = useState<string>();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const elements = useQuery({
    queryKey: ['elements', campaignId],
    queryFn: () =>
      api.request<CampaignElement[]>(`/campaigns/${campaignId}/elements`),
    enabled: Boolean(campaign.data),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['element', elementId],
    queryFn: () => api.request<CampaignElement>(`/elements/${elementId}`),
    enabled: Boolean(elementId && campaign.data),
    retry: false,
  });
  const owner = campaign.data?.currentUserRole === 'OWNER';
  const type = types.includes(params.get('type') as CampaignElementType)
    ? (params.get('type') as CampaignElementType)
    : undefined;
  const visible = useMemo(
    () =>
      (elements.data ?? []).filter(
        (item) =>
          (owner || item.access === 'SHARED') &&
          (!type || item.type === type) &&
          `${item.title} ${item.content}`
            .toLocaleLowerCase(i18n.language)
            .includes(search.trim().toLocaleLowerCase(i18n.language)),
      ),
    [elements.data, owner, type, search, i18n.language],
  );
  const selected =
    elementId && detail.data?.campaignId === campaignId
      ? detail.data
      : undefined;
  const action = useMutation({
    mutationFn: ({
      id,
      verb,
    }: {
      id: string;
      verb: 'publish' | 'hide' | 'delete' | 'board';
    }) =>
      verb === 'board'
        ? api.request(`/campaigns/${campaignId}/cards`, {
            method: 'POST',
            body: JSON.stringify({
              cardKind: 'ELEMENT_REFERENCE',
              elementId: id,
            }),
          })
        : api.request<void>(
            `/elements/${id}${verb === 'delete' ? '' : `/${verb}`}`,
            { method: verb === 'delete' ? 'DELETE' : 'POST' },
          ),
    onSuccess: (_result, variables) => {
      setError(undefined);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaignId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['element', variables.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      if (variables.verb === 'delete')
        navigate(`/campaigns/${campaignId}/elements`);
    },
    onError: (cause) => setError(message(cause, t)),
  });
  if (campaign.isError || elements.isError || detail.isError)
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      <section className="page-header">
        <div>
          <p className="kicker">{t('workspace.elements')}</p>
          <h2>{t('elements.title')}</h2>
        </div>
        {owner && (
          <button onClick={() => setEditor('new')}>{t('elements.new')}</button>
        )}
      </section>
      {editor && (
        <ElementEditor
          key={editor === 'new' ? 'new' : editor.elementId}
          element={editor === 'new' ? undefined : editor}
          initialType={type ?? 'NOTE'}
          onClose={() => setEditor(undefined)}
          onSaved={(saved) => {
            setEditor(undefined);
            void queryClient.invalidateQueries({
              queryKey: ['elements', campaignId],
            });
            void queryClient.invalidateQueries({
              queryKey: ['element', saved.elementId],
            });
            navigate(`/campaigns/${campaignId}/elements/${saved.elementId}`);
          }}
        />
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {campaign.isLoading || elements.isLoading || detail.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <section className="notes-layout">
          <div className="note-list" aria-label={t('elements.title')}>
            <div className="filter-row">
              <Link to={`/campaigns/${campaignId}/elements`}>
                {t('elements.all')}
              </Link>
              {types.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={type === item ? '' : 'button-ghost'}
                  onClick={() => setParams({ type: item })}
                >
                  {t(`elements.types.${item}`)}
                </button>
              ))}
            </div>
            <label className="note-search">
              <span className="visually-hidden">{t('elements.search')}</span>
              <input
                type="search"
                placeholder={t('elements.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {visible.map((item) => (
              <Link
                className={`note-list-item ${elementId === item.elementId ? 'selected' : ''}`}
                to={`/campaigns/${campaignId}/elements/${item.elementId}`}
                key={item.elementId}
              >
                <strong>{item.title}</strong>
                <small>{t(`elements.types.${item.type}`)}</small>
                {owner && (
                  <small
                    className={`visibility-badge visibility-${item.access.toLowerCase()}`}
                  >
                    {t(`elements.access.${item.access}`)}
                  </small>
                )}
              </Link>
            ))}
            {!visible.length && (
              <p className="note-list-empty">{t('elements.empty')}</p>
            )}
          </div>
          <article className="panel note-detail">
            {selected && (owner || selected.access === 'SHARED') ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="kicker">
                      {t(`elements.types.${selected.type}`)}
                    </p>
                    <h2>{selected.title}</h2>
                    {owner && (
                      <span
                        className={`visibility-badge visibility-${selected.access.toLowerCase()}`}
                      >
                        {t(`elements.access.${selected.access}`)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="markdown-preview">
                  <SafeMarkdown content={selected.content} />
                </div>
                {selected.type === 'LOCATION' &&
                  selected.imageUrl &&
                  /^https:\/\//i.test(selected.imageUrl) && (
                    <ElementMapViewer
                      key={selected.elementId + selected.imageUrl}
                      imageUrl={selected.imageUrl}
                      title={selected.title}
                    />
                  )}
                {selected.type === 'NPC' &&
                  npcFields.map((field) =>
                    selected.typeData?.[field] ? (
                      <p key={field}>
                        <strong>{t(`elements.npc.${field}`)}:</strong>{' '}
                        {String(selected.typeData[field])}
                      </p>
                    ) : null,
                  )}
                {campaign.data?.currentUserRole !== 'VIEWER' && (
                  <div className="action-row">
                    {owner &&
                      (selected.access === 'MASTER_ONLY' ? (
                        <button
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              id: selected.elementId,
                              verb: 'publish',
                            })
                          }
                        >
                          {t('elements.publish')}
                        </button>
                      ) : (
                        <button
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              id: selected.elementId,
                              verb: 'hide',
                            })
                          }
                        >
                          {t('elements.hide')}
                        </button>
                      ))}
                    {selected.access === 'SHARED' && (
                      <button
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            id: selected.elementId,
                            verb: 'board',
                          })
                        }
                      >
                        {t('elements.addToBoard')}
                      </button>
                    )}
                    {owner && (
                      <button
                        className="button-ghost"
                        onClick={() => setEditor(selected)}
                      >
                        {t('common.edit')}
                      </button>
                    )}
                    {owner && (
                      <button
                        className="button-danger"
                        disabled={action.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              t('elements.deleteConfirmation', {
                                title: selected.title,
                              }),
                            )
                          )
                            action.mutate({
                              id: selected.elementId,
                              verb: 'delete',
                            });
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="muted">
                {elementId
                  ? t('errors.resource.not_found')
                  : t('elements.select')}
              </p>
            )}
          </article>
        </section>
      )}
    </CampaignWorkspaceShell>
  );
}
