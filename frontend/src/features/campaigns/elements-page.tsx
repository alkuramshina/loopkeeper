import { NewMark } from '../../components/ui/new-mark';
import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ListFilter, Plus } from 'lucide-react';
import {
  ApiError,
  Campaign,
  CampaignElement,
  CampaignElementType,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';
import { PageError } from '../../components/page-error';
import { PageHeader } from '../../components/page-header';
import { ProtectedImage } from '../../components/protected-image';
import { AccessBadge } from '../../components/ui/access-badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { iconProps } from '../../components/ui/icon';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { Skeleton } from '../../components/ui/skeleton';
import { useToast } from '../../components/ui/toast';
import { typeIcons } from '../../components/ui/type-tag';
import { ElementDetail } from './element-detail';
import { apiErrorText, elementTypes, npcLimits } from './element-model';
import './materials.css';
const materialTypes = elementTypes.filter((type) => type !== 'NOTE');

type AccessFilter = 'all' | 'shared' | 'hidden';

/**
 * A new material starts from its type and name (and an NPC's role, which the
 * backend requires); the text is written right after, with autosave. The
 * master's material always starts hidden: revealing is a separate step.
 */
function CreateElementDialog({
  initialType,
  onClose,
  onCreated,
}: {
  initialType?: CampaignElementType;
  onClose: () => void;
  onCreated: (element: CampaignElement) => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const [type, setType] = useState<CampaignElementType>(
    initialType ?? 'LOCATION',
  );
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string>();
  const create = useMutation({
    mutationFn: () =>
      api.request<CampaignElement>(`/campaigns/${campaignId}/elements`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: title.trim(),
          content: '',
          access: 'MASTER_ONLY',
          ...(type === 'NPC' ? { typeData: { role: role.trim() } } : {}),
        }),
      }),
    onSuccess: onCreated,
    onError: (cause) => setError(apiErrorText(cause, t)),
  });

  return (
    <ModalDialog
      description={t('elements.create.hint')}
      onClose={onClose}
      title={t('elements.create.title')}
    >
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label>
          {t('elements.type')}
          <select
            onChange={(event) =>
              setType(event.target.value as CampaignElementType)
            }
            value={type}
          >
            {materialTypes.map((item) => (
              <option key={item} value={item}>
                {t(`elements.types.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('elements.name')}
          <input
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        {type === 'NPC' && (
          <label>
            {t('elements.npc.role')}
            <input
              maxLength={npcLimits.role}
              onChange={(event) => setRole(event.target.value)}
              required
              value={role}
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="access-dialog-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={create.isPending} type="submit" variant="primary">
            {t('elements.create.submit')}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}

function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="materials-skeleton">
      <span className="visually-hidden">{t('common.loading')}</span>
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton height="2.5rem" key={row} />
      ))}
    </div>
  );
}

export function ElementsPage() {
  const { campaignId, elementId } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  // A link may ask for a type up front, e.g. "?type=LOCATION".
  const requestedType = materialTypes.find(
    (type) => type === params.get('type'),
  );
  const navigate = useNavigate();
  const { api, profile } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [creating, setCreating] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
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
  const role = campaign.data?.currentUserRole;
  const owner = role === 'OWNER';
  const isAuthor = (item: CampaignElement) =>
    Boolean(profile) && item.createdById === profile?.userId;
  const listPath = `/campaigns/${campaignId}/elements`;

  const present = useMemo(
    () =>
      (elements.data ?? []).filter(
        (item) =>
          !pendingDeletes.includes(item.elementId) &&
          !(
            owner &&
            item.type === 'NOTE' &&
            item.createdById === profile?.userId
          ),
      ),
    [elements.data, pendingDeletes, owner, profile?.userId],
  );
  const counts = {
    all: present.length,
    shared: present.filter((item) => item.access === 'SHARED').length,
    hidden: present.filter((item) => item.access !== 'SHARED').length,
  };
  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(i18n.language);
    const matches = present.filter(
      (item) =>
        (accessFilter === 'all' ||
          (accessFilter === 'shared') === (item.access === 'SHARED')) &&
        `${item.title} ${item.content ?? ''}`
          .toLocaleLowerCase(i18n.language)
          .includes(term),
    );
    // The master thinks by type; notes written by players are their own group.
    const playerNotes = owner
      ? matches.filter((item) => item.createdById !== profile?.userId)
      : [];
    const rest = matches.filter((item) => !playerNotes.includes(item));
    return [
      ...materialTypes.map((type) => ({
        key: type,
        label: t(`elements.groups.${type}`),
        items: rest.filter((item) => item.type === type),
      })),
      {
        key: 'PLAYER_NOTES',
        label: t('elements.groups.PLAYER_NOTES'),
        items: playerNotes,
      },
    ].filter((group) => group.items.length);
  }, [present, search, accessFilter, owner, profile?.userId, i18n.language, t]);

  const selected =
    elementId &&
    detail.data?.campaignId === campaignId &&
    !pendingDeletes.includes(elementId)
      ? detail.data
      : undefined;
  const unavailable =
    Boolean(elementId) &&
    (pendingDeletes.includes(elementId ?? '') ||
      (detail.error instanceof ApiError && detail.error.status === 404) ||
      (detail.data !== undefined && detail.data.campaignId !== campaignId));

  // Deleting waits for the notification to expire, so "Undo" costs nothing.
  const scheduleDelete = (element: CampaignElement) => {
    const id = element.elementId;
    setPendingDeletes((current) => [...current, id]);
    void navigate(listPath);
    const restore = () =>
      setPendingDeletes((current) => current.filter((item) => item !== id));
    toast.show({
      message: t('elements.deleted', { title: element.title }),
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

  const detailFailed =
    detail.isError &&
    !(detail.error instanceof ApiError && detail.error.status === 404);
  if (campaign.isError || elements.isError || detailFailed)
    return (
      <PageError
        inline
        error={campaign.error ?? elements.error ?? detail.error ?? undefined}
        onRetry={() => {
          void campaign.refetch();
          void elements.refetch();
          void detail.refetch();
        }}
      />
    );

  // Players read the case and write their own notes; the list is the master's.
  if (role && !owner)
    return (
      <Navigate
        replace
        to={`/campaigns/${campaignId}/case${elementId ? `/${elementId}` : ''}`}
      />
    );

  if (selected?.type === 'NOTE' && isAuthor(selected))
    return (
      <Navigate
        replace
        to={`/campaigns/${campaignId}/notes/${selected.elementId}`}
      />
    );

  const loading = campaign.isLoading || elements.isLoading;
  const emptyCatalog = !loading && present.length === 0;
  const nothingFound = !loading && present.length > 0 && groups.length === 0;

  return (
    <>
      <PageHeader
        title={t('elements.title')}
        actions={
          <Button
            icon={Plus}
            onClick={() => setCreating(true)}
            variant="primary"
          >
            {t('elements.new')}
          </Button>
        }
      />
      <div
        className={`materials-layout ${elementId ? 'materials-layout-detail' : ''}`}
      >
        <section
          aria-label={t('elements.title')}
          className="materials-list-pane"
        >
          <div className="materials-list-head">
            {owner && (
              <SegmentedControl
                label={t('elements.accessFilter')}
                onChange={setAccessFilter}
                options={[
                  {
                    value: 'all',
                    label: t('elements.filter.all'),
                    count: counts.all,
                  },
                  {
                    value: 'shared',
                    label: t('elements.filter.shared'),
                    count: counts.shared,
                  },
                  {
                    value: 'hidden',
                    label: t('elements.filter.hidden'),
                    count: counts.hidden,
                  },
                ]}
                value={accessFilter}
              />
            )}
            <label className="materials-search">
              <ListFilter {...iconProps} />
              <span className="visually-hidden">{t('elements.search')}</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('elements.search')}
                type="search"
                value={search}
              />
            </label>
          </div>
          <nav
            aria-busy={loading}
            aria-label={t('elements.listLabel')}
            className="materials-list"
          >
            {loading && <ListSkeleton />}
            {groups.map((group) => (
              <section
                aria-labelledby={`materials-group-${group.key}`}
                className="materials-group"
                key={group.key}
              >
                <h2 className="materials-group-title">
                  <span id={`materials-group-${group.key}`}>{group.label}</span>
                  <span className="numeric">{group.items.length}</span>
                </h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.elementId}>
                      <Link
                        aria-current={
                          item.elementId === elementId ? 'page' : undefined
                        }
                        className={
                          owner && isAuthor(item) && item.access !== 'SHARED'
                            ? 'materials-row materials-row-hidden'
                            : 'materials-row'
                        }
                        to={`${listPath}/${item.elementId}`}
                      >
                        {item.coverUrl ? (
                          <ProtectedImage
                            alt=""
                            className="materials-row-cover"
                            imageUrl={item.coverUrl}
                          />
                        ) : (
                          <TypeIcon type={item.type} />
                        )}
                        <span className="materials-row-title">
                          {item.title}
                          {item.isNew && <NewMark />}
                        </span>
                        {(owner || isAuthor(item)) && (
                          <AccessBadge
                            access={item.access}
                            variant={
                              owner && isAuthor(item) ? 'status' : 'visibility'
                            }
                          />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {nothingFound && (
              <p className="materials-list-note">
                {t('elements.nothingFound')}
              </p>
            )}
          </nav>
          {emptyCatalog && (
            <EmptyState
              action={
                <Button
                  icon={Plus}
                  onClick={() => setCreating(true)}
                  variant="primary"
                >
                  {t('elements.new')}
                </Button>
              }
              title={t('elements.emptyOwner')}
            >
              <p>{t('elements.emptyOwnerText')}</p>
            </EmptyState>
          )}
        </section>
        <section className="materials-detail-pane">
          {selected ? (
            <ElementDetail
              backTo={listPath}
              element={selected}
              key={selected.elementId}
              onDelete={scheduleDelete}
              startEditing={Boolean(
                (location.state as { edit?: boolean } | null)?.edit,
              )}
              viewer={{
                owner,
                contributor: owner,
                isAuthor: isAuthor(selected),
              }}
            />
          ) : unavailable ? (
            <EmptyState title={t('elements.unavailable')}>
              <p>{t('elements.unavailableText')}</p>
              <Link to={listPath}>{t('elements.backToMaterials')}</Link>
            </EmptyState>
          ) : elementId ? (
            <div aria-busy="true" className="material-document">
              <Skeleton width="8rem" height="1.625rem" radius="pill" />
              <Skeleton width="60%" height="2.5rem" />
              <Skeleton height="6rem" />
            </div>
          ) : (
            !emptyCatalog &&
            !loading && (
              <p className="materials-select">{t('elements.select')}</p>
            )
          )}
        </section>
      </div>
      {creating && (
        <CreateElementDialog
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            queryClient.setQueryData(['element', created.elementId], created);
            void queryClient.invalidateQueries({
              queryKey: ['elements', campaignId],
            });
            void navigate(`${listPath}/${created.elementId}`, {
              state: { edit: true },
            });
          }}
          initialType={requestedType}
        />
      )}
    </>
  );
}

// The group heading names the type; the row repeats only its icon.
function TypeIcon({ type }: { type: CampaignElementType }) {
  const Icon = typeIcons[type];
  return <Icon {...iconProps} className="materials-row-icon" />;
}
