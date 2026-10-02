import { useElementView, ViewSaveStatus } from './use-entity-views';
import { PageError } from '../../components/page-error';
import { NewMark } from '../../components/ui/new-mark';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LayoutDashboard,
  Pencil,
  Trash2,
} from 'lucide-react';
import { CampaignElement } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { MediaUpload } from '../../components/media-upload';
import { ProtectedImage } from '../../components/protected-image';
import { SafeMarkdown } from '../../components/safe-markdown';
import { AutosaveStatus, useAutosave } from '../../components/use-autosave';
import { AccessBadge } from '../../components/ui/access-badge';
import { Button } from '../../components/ui/button';
import { iconProps } from '../../components/ui/icon';
import { MenuButton, MenuItem } from '../../components/ui/menu-button';
import { TypeTag } from '../../components/ui/type-tag';
import { ElementMapViewer } from './element-map-viewer';
import {
  externalMapUrl,
  formatChanged,
  isExternalMapUrl,
  isMapUrl,
  isUploadedMedia,
  npcFields,
  npcLimits,
  npcText,
} from './element-model';
import { useAccessChange, useAddToBoard } from './use-element-actions';

export type Viewer = {
  owner: boolean;
  contributor: boolean;
  isAuthor: boolean;
};

type Draft = {
  title: string;
  content: string;
  imageUrl: string;
  typeData: Record<string, string>;
};

const draftFor = (element: CampaignElement): Draft => ({
  title: element.title,
  content: element.content ?? '',
  imageUrl: externalMapUrl(element),
  typeData: Object.fromEntries(
    npcFields.map((field) => [field, npcText(element.typeData?.[field])]),
  ),
});

function draftProblems(draft: Draft, element: CampaignElement) {
  return {
    title: !draft.title.trim(),
    role: element.type === 'NPC' && !draft.typeData.role?.trim(),
    imageUrl:
      element.type === 'LOCATION' && !isExternalMapUrl(draft.imageUrl.trim()),
  };
}

/** Access status and the rarely used actions; revealing stands apart. */
function MaterialToolbar({
  element,
  viewer,
  editing,
  saveStatus,
  backTo,
  onEdit,
  onDone,
  onRetry,
  beforeAccessChange,
  onDelete,
  hasReaderActions,
}: {
  element: CampaignElement;
  viewer: Viewer;
  editing: boolean;
  saveStatus?: AutosaveStatus;
  backTo: string;
  onEdit: () => void;
  onDone: () => void;
  onRetry: () => void;
  beforeAccessChange: () => Promise<boolean>;
  onDelete: (element: CampaignElement) => void;
  hasReaderActions: boolean;
}) {
  const { t } = useTranslation();
  const { owner, contributor, isAuthor } = viewer;
  const canEdit = contributor && isAuthor;
  const playerNote = !(owner && isAuthor);
  // The preview must show what is saved, including the last keystrokes; an
  // unsaved draft keeps its status message instead.
  const accessChange = useAccessChange({
    element,
    owner,
    beforeChange: beforeAccessChange,
  });
  const requestAccess = accessChange.request;
  const addToBoard = useAddToBoard(element.elementId);

  const menu: MenuItem[] = [
    // A reader's own action bar already offers the board.
    ...(contributor && element.access === 'SHARED' && !hasReaderActions
      ? [
          {
            label: t('elements.addToBoard'),
            icon: LayoutDashboard,
            disabled: addToBoard.isPending,
            onSelect: () => addToBoard.mutate(),
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            label: t('elements.delete'),
            icon: Trash2,
            danger: true,
            onSelect: () => onDelete(element),
          },
        ]
      : []),
  ];

  return (
    <header className="material-toolbar">
      <Link className="material-back" to={backTo}>
        <ArrowLeft {...iconProps} />
        {t(owner ? 'elements.backToMaterials' : 'elements.backToCase')}
      </Link>
      <div className="material-toolbar-status">
        {(owner || isAuthor) && (
          <AccessBadge
            access={element.access}
            variant={playerNote ? 'visibility' : 'status'}
          />
        )}
        {editing && saveStatus && (
          <span className="material-save-status" role="status">
            {saveStatus === 'saved'
              ? t('elements.autosave.saved')
              : saveStatus === 'invalid'
                ? t('elements.autosave.invalid')
                : saveStatus === 'error'
                  ? t('elements.autosave.error')
                  : t('elements.autosave.saving')}
            {saveStatus === 'error' && (
              <button
                className="material-link-button"
                onClick={onRetry}
                type="button"
              >
                {t('common.retry')}
              </button>
            )}
          </span>
        )}
      </div>
      <div className="material-toolbar-actions">
        {canEdit &&
          (editing ? (
            <Button icon={Check} onClick={onDone}>
              {t('elements.done')}
            </Button>
          ) : (
            <Button icon={Pencil} onClick={onEdit}>
              {t('elements.edit')}
            </Button>
          ))}
        {menu.length > 0 && (
          <MenuButton items={menu} label={t('elements.moreActions')} />
        )}
      </div>
      {canEdit && owner && (
        <div className="material-toolbar-reveal">
          {element.access === 'SHARED' ? (
            <Button icon={EyeOff} onClick={() => requestAccess('MASTER_ONLY')}>
              {t('elements.hideAction')}
            </Button>
          ) : (
            <Button
              icon={Eye}
              onClick={() => requestAccess('SHARED')}
              variant="primary"
            >
              {t('elements.revealAction')}
            </Button>
          )}
        </div>
      )}
      {accessChange.dialogs}
    </header>
  );
}

function MaterialMeta({ element }: { element: CampaignElement }) {
  const { t } = useTranslation();
  return (
    <p className="material-meta">
      <TypeTag type={element.type} />
      <span>
        {t('elements.changed', { when: formatChanged(element.updatedAt, t) })}
      </span>
    </p>
  );
}

function ReadMaterial({
  element,
  viewer,
}: {
  element: CampaignElement;
  viewer: Viewer;
}) {
  const { t } = useTranslation();
  return (
    <div className="material-document">
      <MaterialMeta element={element} />
      <h2 className="material-title">{element.title}</h2>
      {!viewer.isAuthor && (
        <p className="material-author">
          {t('elements.author', {
            name: element.createdBy.name ?? t('elements.unnamedAuthor'),
          })}
        </p>
      )}
      {element.content && (
        <div className="markdown-body material-text">
          <SafeMarkdown content={element.content} />
        </div>
      )}
      {element.type === 'NPC' && (
        <dl className="material-facts">
          {npcFields.map((field) =>
            npcText(element.typeData?.[field]) ? (
              <div key={field}>
                <dt>{t(`elements.npc.${field}`)}</dt>
                <dd>{npcText(element.typeData[field])}</dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
      {element.coverUrl && (
        <figure className="material-figure">
          <ProtectedImage
            alt=""
            className="element-cover"
            imageUrl={element.coverUrl}
          />
        </figure>
      )}
      {element.type === 'LOCATION' &&
        element.imageUrl &&
        isMapUrl(element.imageUrl) && (
          <ElementMapViewer
            key={element.elementId + element.imageUrl}
            imageUrl={element.imageUrl}
            title={element.title}
          />
        )}
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
  }) => ReactNode;
}) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="material-field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-describedby': described || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <p className="ui-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ui-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function EditMaterial({
  element,
  onStatus,
  registerFlush,
}: {
  element: CampaignElement;
  onStatus: (status: AutosaveStatus) => void;
  registerFlush: (flush: () => Promise<boolean>) => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftFor(element));
  const server = useRef(element);
  useEffect(() => {
    server.current = element;
  }, [element]);
  const problems = draftProblems(draft, element);
  const valid = !Object.values(problems).some(Boolean);

  const { status, flush } = useAutosave({
    value: draft,
    valid,
    save: async (value: Draft) => {
      // An unchanged map link is not sent, so saving keeps an uploaded map
      // file; a new link (or clearing a link) replaces the map.
      const imageUrl = value.imageUrl.trim();
      const mapChanged = imageUrl !== externalMapUrl(server.current);
      const saved = await api.request<CampaignElement>(
        `/elements/${element.elementId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: value.title.trim(),
            content: value.content,
            ...(element.type === 'LOCATION' && mapChanged
              ? { imageUrl: imageUrl || null }
              : {}),
            ...(element.type === 'NPC'
              ? {
                  typeData: Object.fromEntries(
                    Object.entries(value.typeData).filter(
                      ([field, text]) => field === 'role' || text,
                    ),
                  ),
                }
              : {}),
          }),
        },
      );
      server.current = saved;
      queryClient.setQueryData(['element', element.elementId], saved);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaignId],
      });
    },
  });
  useEffect(() => onStatus(status), [status, onStatus]);
  useEffect(() => registerFlush(flush), [flush, registerFlush]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['element', element.elementId] });

  return (
    <div className="material-document material-document-editing">
      <MaterialMeta element={element} />
      <Field
        error={problems.title ? t('elements.titleRequired') : undefined}
        label={t('elements.name')}
      >
        {(props) => (
          <input
            {...props}
            className="material-title-input"
            maxLength={200}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
            value={draft.title}
          />
        )}
      </Field>
      <Field hint={t('elements.markdownHint')} label={t('elements.content')}>
        {(props) => (
          <textarea
            {...props}
            className="material-text-input"
            maxLength={10000}
            onChange={(event) =>
              setDraft({ ...draft, content: event.target.value })
            }
            value={draft.content}
          />
        )}
      </Field>
      {element.type === 'NPC' &&
        npcFields.map((field) => (
          <Field
            error={
              field === 'role' && problems.role
                ? t('elements.roleRequired')
                : undefined
            }
            key={field}
            label={t(`elements.npc.${field}`)}
          >
            {(props) => (
              <input
                {...props}
                maxLength={npcLimits[field]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    typeData: {
                      ...draft.typeData,
                      [field]: event.target.value,
                    },
                  })
                }
                value={draft.typeData[field] ?? ''}
              />
            )}
          </Field>
        ))}
      <section
        aria-label={t('elements.images')}
        className="element-media-controls"
      >
        <div>
          {element.coverUrl && (
            <figure className="material-figure">
              <ProtectedImage
                alt=""
                className="element-cover"
                imageUrl={element.coverUrl}
              />
            </figure>
          )}
          <MediaUpload
            endpoint={`/elements/${element.elementId}/cover`}
            hasImage={Boolean(element.coverUrl)}
            label={t('elements.cover')}
            onChanged={refresh}
          />
          <p className="muted">{t('elements.coverHint')}</p>
        </div>
        {element.type === 'LOCATION' && (
          <>
            <Field
              error={
                problems.imageUrl ? t('elements.mapUrlInvalid') : undefined
              }
              hint={
                isUploadedMedia(element.imageUrl)
                  ? t('elements.mapUrlReplacesFile')
                  : undefined
              }
              label={t('elements.mapUrl')}
            >
              {(props) => (
                <input
                  {...props}
                  maxLength={2048}
                  onChange={(event) =>
                    setDraft({ ...draft, imageUrl: event.target.value })
                  }
                  placeholder="https://"
                  type="url"
                  value={draft.imageUrl}
                />
              )}
            </Field>
            <div>
              <MediaUpload
                endpoint={`/elements/${element.elementId}/map`}
                hasImage={isUploadedMedia(element.imageUrl)}
                label={t('elements.mapFile')}
                onChanged={async () => {
                  // The file replaces the link; do not send the old link back.
                  setDraft((current) => ({ ...current, imageUrl: '' }));
                  await refresh();
                }}
              />
              <p className="muted">{t('elements.mapFileHint')}</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function ElementDetail({
  element,
  viewer,
  backTo,
  startEditing,
  onDelete,
  readerActions,
}: {
  element: CampaignElement;
  viewer: Viewer;
  backTo: string;
  startEditing: boolean;
  onDelete: (element: CampaignElement) => void;
  /** Frequent actions of a reader, kept at hand below the text. */
  readerActions?: ReactNode;
}) {
  const view = useElementView(element);
  const canEdit = viewer.contributor && viewer.isAuthor;
  const [editing, setEditing] = useState(startEditing && canEdit);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('saved');
  const flushRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
  const registerFlush = useRef((flush: () => Promise<boolean>) => {
    flushRef.current = flush;
  }).current;

  if (view.unavailable)
    return (
      <PageError unavailableKey="elements.unavailable" error={undefined} />
    );
  return (
    <article
      aria-label={element.title}
      className={
        // Master material hidden from players carries the theme's texture.
        viewer.owner && viewer.isAuthor && element.access !== 'SHARED'
          ? 'material-detail material-detail-hidden'
          : 'material-detail'
      }
    >
      <MaterialToolbar
        backTo={backTo}
        beforeAccessChange={() => flushRef.current()}
        editing={editing}
        element={element}
        hasReaderActions={Boolean(readerActions)}
        onDelete={onDelete}
        onDone={() => {
          // Leave editing only when everything is saved; otherwise the
          // status next to the badge says what is missing.
          void flushRef.current().then((saved) => {
            if (!saved) return;
            setEditing(false);
            flushRef.current = () => Promise.resolve(true);
          });
        }}
        onEdit={() => {
          setSaveStatus('saved');
          setEditing(true);
        }}
        onRetry={() => void flushRef.current()}
        saveStatus={saveStatus}
        viewer={viewer}
      />
      <ViewSaveStatus failed={view.failed} retry={view.retry} />
      {element.isNew && <NewMark />}
      <div className="material-scroll">
        {editing ? (
          <EditMaterial
            element={element}
            onStatus={setSaveStatus}
            registerFlush={registerFlush}
          />
        ) : (
          <ReadMaterial element={element} viewer={viewer} />
        )}
      </div>
      {readerActions && (
        <footer className="material-reader-actions">{readerActions}</footer>
      )}
    </article>
  );
}
