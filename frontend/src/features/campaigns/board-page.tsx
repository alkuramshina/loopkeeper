import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  OnNodeDrag,
  NodeResizer,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useViewport,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './board-redesign.css';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Board, BoardCard, BoardLink, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ProtectedImage } from '../../components/protected-image';
import {
  CampaignBackgroundLayer,
  useCampaignBackground,
} from './use-campaign-background';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { errorMessage, PageError } from '../../components/page-error';
import { formText } from '../../components/form-text';
import { TypeTag } from '../../components/ui/type-tag';
import { NewMark } from '../../components/ui/new-mark';
import { AccessBadge } from '../../components/ui/access-badge';
import { useToast } from '../../components/ui/toast';
import { ArrowUpRight, Link2, Maximize2, Plus, Search } from 'lucide-react';

type NodeDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type BoardNodeData = {
  card: BoardCard;
  isNew: boolean;
  linkCount: number;
  canManage: boolean;
  onResizeEnd: (dimensions: NodeDimensions) => void;
};
type EditorTarget =
  | { type: 'card'; card: BoardCard }
  | { type: 'link'; link: BoardLink }
  | { type: 'new-card' };

const apiErrorMessage = errorMessage;

function boardNodes(
  cards: BoardCard[],
  links: BoardLink[],
  canManage: boolean,
  newSinceAt: string | null | undefined,
  userId: string | undefined,
  onResizeEnd: (cardId: string, dimensions: NodeDimensions) => void,
): Node<BoardNodeData>[] {
  return cards.map((card, index) => ({
    id: card.cardId,
    type: 'card',
    position: {
      x: card.node?.x ?? 80 + (index % 4) * 280,
      y: card.node?.y ?? 80 + Math.floor(index / 4) * 210,
    },
    width: card.node?.width ?? 240,
    height: card.node?.height ?? 160,
    data: {
      card,
      isNew: Boolean(
        newSinceAt &&
        card.createdAt > newSinceAt &&
        card.createdBy?.userId !== userId,
      ),
      linkCount: links.filter(
        (link) =>
          link.fromCardId === card.cardId || link.toCardId === card.cardId,
      ).length,
      canManage,
      onResizeEnd: (dimensions) => onResizeEnd(card.cardId, dimensions),
    },
  }));
}

function boardEdges(
  links: BoardLink[],
  newSinceAt?: string | null,
  userId?: string,
  newLabel?: string,
): Edge[] {
  const pathStrategy: Edge['type'] = 'default';
  return links.map((link) => ({
    id: link.linkId,
    source: link.fromCardId,
    target: link.toCardId,
    label:
      newSinceAt &&
      link.createdAt &&
      link.createdAt > newSinceAt &&
      link.createdById !== userId
        ? [link.label, newLabel].filter(Boolean).join(' · ')
        : link.label,
    type: pathStrategy,
  }));
}

function BoardPattern() {
  const { x, y, zoom } = useViewport();
  return (
    <div
      aria-hidden="true"
      className="board-pattern"
      style={{
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: `calc(var(--board-pattern-size) * ${zoom})`,
      }}
    />
  );
}

function InvestigationCard({ data, selected }: NodeProps<Node<BoardNodeData>>) {
  const { t } = useTranslation();
  const { campaignId } = useParams();
  const { card } = data;
  return (
    <article className={`flow-card ${selected ? 'selected' : ''}`}>
      <NodeResizer
        isVisible={selected && data.canManage}
        maxHeight={2000}
        maxWidth={2000}
        minHeight={60}
        minWidth={80}
        onResizeEnd={(_event, dimensions) => data.onResizeEnd(dimensions)}
      />
      <Handle type="target" position={Position.Top} />
      {card.reference?.coverUrl && (
        <ProtectedImage
          alt=""
          className="flow-card-cover"
          draggable={false}
          imageUrl={card.reference.coverUrl}
        />
      )}
      <div className="flow-card-top">
        {data.isNew && <NewMark />}
        <TypeTag
          type={
            card.cardKind === 'FREE'
              ? 'FREE'
              : card.reference?.kind === 'CHARACTER'
                ? 'CHARACTER'
                : card.reference?.type || 'OTHER'
          }
        />
        {card.color && (
          <span
            className={`board-color-mark board-color-${card.color}`}
            aria-label={t(`board.colors.${card.color}`)}
          />
        )}
      </div>
      <h3>{card.title}</h3>
      {card.content && <p className="flow-card-preview">{card.content}</p>}
      {card.tags.length > 0 && (
        <small className="flow-card-tags">
          {card.tags.map((tag) => `#${tag}`).join(' ')}
        </small>
      )}
      <div className="flow-card-meta">
        <span>
          {card.createdBy?.name || t('board.unknownAuthor')} ·{' '}
          {card.createdAt
            ? new Intl.DateTimeFormat('ru', {
                day: 'numeric',
                month: 'short',
              }).format(new Date(card.createdAt))
            : ''}
        </span>
        {data.linkCount > 0 && (
          <span>{t('board.linkCount', { count: data.linkCount })}</span>
        )}
      </div>
      {card.reference?.kind === 'ELEMENT' && card.reference.elementId && (
        <Link
          className="flow-card-source nodrag"
          to={`/campaigns/${campaignId}/elements/${card.reference.elementId}`}
          aria-label={t('board.openSource')}
          onClick={(event) => event.stopPropagation()}
        >
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      )}
      <Handle type="source" position={Position.Bottom} />
    </article>
  );
}

const nodeTypes = { card: InvestigationCard };

const cardColors = ['ochre', 'rose', 'blue', 'olive', 'grey'] as const;
const cardIcons = ['clue', 'person', 'place', 'question', 'warning'];

function BoardTools({
  canManage,
  onNewCard,
  linking,
  onLinkingChange,
}: {
  canManage: boolean;
  onNewCard: () => void;
  linking: boolean;
  onLinkingChange: () => void;
}) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="board-tools">
      {canManage && (
        <>
          <button type="button" onClick={onNewCard}>
            <Plus aria-hidden="true" size={16} />
            {t('board.cardAction')}
          </button>
          <button
            type="button"
            className={linking ? 'active' : ''}
            onClick={onLinkingChange}
          >
            <Link2 aria-hidden="true" size={16} />
            {t('board.linkAction')}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => void fitView({ duration: 250, padding: 0.15 })}
      >
        <Maximize2 aria-hidden="true" size={16} />
        {t('board.fitAll')}
      </button>
    </Panel>
  );
}

function TagComposer({ initialTags }: { initialTags: string[] }) {
  const { t } = useTranslation();
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState('');

  function addTag() {
    const tag = draft.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag) || tags.length >= 30 || tag.length > 50)
      return;
    setTags([...tags, tag]);
    setDraft('');
  }

  return (
    <fieldset className="tag-composer">
      <legend>{t('board.tags')}</legend>
      <input name="tags" type="hidden" value={tags.join(',')} readOnly />
      <div className="tag-composer-list">
        {tags.map((tag) => (
          <button
            key={tag}
            className="tag-chip"
            onClick={() => setTags(tags.filter((item) => item !== tag))}
            type="button"
          >
            #{tag} ×
          </button>
        ))}
      </div>
      <div className="tag-composer-input">
        <input
          aria-label={t('board.newTag')}
          maxLength={50}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder={t('board.newTag')}
          value={draft}
        />
        <button onClick={addTag} type="button">
          {t('board.addTag')}
        </button>
      </div>
    </fieldset>
  );
}

function CardEditor({
  target,
  onClose,
  onLinkStart,
}: {
  target: EditorTarget;
  onClose: () => void;
  onLinkStart: (cardId: string) => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const isNew = target.type === 'new-card';
  const card = target.type === 'card' ? target.card : undefined;
  const link = target.type === 'link' ? target.link : undefined;
  const boardSnapshot = queryClient.getQueryData<Board>(['board', campaignId]);
  const cardLinks = card
    ? (boardSnapshot?.links.filter(
        (item) =>
          item.fromCardId === card.cardId || item.toCardId === card.cardId,
      ) ?? [])
    : [];
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (isNew) {
        return api.request<BoardCard>(`/campaigns/${campaignId}/cards`, {
          method: 'POST',
          body: JSON.stringify({
            cardKind: 'FREE',
            title: formText(form, 'title'),
            content: formText(form, 'content') || undefined,
            tags: parseTags(formText(form, 'tags')),
            color: formText(form, 'color') || undefined,
            icon: formText(form, 'icon') || undefined,
          }),
        });
      }
      if (card) {
        return api.request<BoardCard>(`/cards/${card.cardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(card.cardKind === 'FREE'
              ? {
                  title: formText(form, 'title'),
                  content: formText(form, 'content') || undefined,
                }
              : {}),
            tags: parseTags(formText(form, 'tags')),
            color: formText(form, 'color') || undefined,
            icon: formText(form, 'icon') || undefined,
          }),
        });
      }
      return api.request<BoardLink>(`/investigation-links/${link?.linkId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: formText(form, 'label') || undefined,
        }),
      });
    },
    onSuccess: async (result) => {
      if (isNew && campaignId) {
        const current = queryClient.getQueryData<Board>(['board', campaignId]);
        const index = current?.cards.length ?? 0;
        const newCard = result as BoardCard;
        try {
          await api.request(`/investigation-board/nodes/${newCard.cardId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              x: 80 + (index % 4) * 280,
              y: 80 + Math.floor(index / 4) * 210,
              width: 240,
              height: 160,
            }),
          });
        } catch {
          // The card itself was created. It remains usable with the board's default position.
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  function scheduleRemoval() {
    const path = card
      ? `/cards/${card.cardId}`
      : `/investigation-links/${link?.linkId}`;
    const commitRemoval = () => {
      void api
        .request<void>(path, { method: 'DELETE' })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ['board', campaignId] }),
        )
        .catch((cause) => toast.show({ message: apiErrorMessage(cause, t) }));
    };
    toast.show({
      message: t(card ? 'board.cardRemoved' : 'board.linkRemoved'),
      onUndo: () => undefined,
      onExpire: commitRemoval,
    });
    onClose();
  }

  // Move keyboard focus into the inspector and give it back on close.
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    inspectorRef.current
      ?.querySelector<HTMLElement>(
        'input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select',
      )
      ?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [target]);

  const heading = isNew
    ? t('board.newCard')
    : card
      ? t('board.editCard')
      : t('board.editLink');
  return (
    <aside
      aria-label={heading}
      className="board-inspector panel"
      ref={inspectorRef}
    >
      <div className="section-heading">
        <h2>{heading}</h2>
        <button className="button-ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
      {card && (
        <div className="board-inspector-summary">
          <TypeTag
            type={
              card.cardKind === 'FREE'
                ? 'FREE'
                : card.reference?.kind === 'CHARACTER'
                  ? 'CHARACTER'
                  : card.reference?.type || 'OTHER'
            }
          />
          <h3>{card.title}</h3>
          {card.reference?.kind === 'ELEMENT' && (
            <>
              <AccessBadge access="SHARED" />
              <Link
                to={`/campaigns/${campaignId}/elements/${card.reference.elementId}`}
              >
                {t('board.openSource')}{' '}
                <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </>
          )}
          {card.createdBy && (
            <p>
              {card.createdBy.name || t('board.unknownAuthor')} ·{' '}
              {new Intl.DateTimeFormat('ru', { dateStyle: 'medium' }).format(
                new Date(card.createdAt),
              )}
            </p>
          )}
          {cardLinks.length > 0 && (
            <div className="board-inspector-links">
              <strong>{t('board.links')}</strong>
              {cardLinks.map((item) => {
                const other = boardSnapshot?.cards.find(
                  (candidate) =>
                    candidate.cardId ===
                    (item.fromCardId === card.cardId
                      ? item.toCardId
                      : item.fromCardId),
                );
                return (
                  <span key={item.linkId}>
                    {other?.title || t('board.unavailableCard')}
                    {item.label ? ` · ${item.label}` : ''}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
      <form onSubmit={(event) => save.mutate(formData(event))}>
        {link ? (
          <label>
            {t('board.linkLabel')}
            <input
              name="label"
              defaultValue={link.label ?? ''}
              maxLength={200}
            />
          </label>
        ) : (
          <>
            <label>
              {t('board.cardTitle')}
              <input
                name="title"
                defaultValue={card?.title ?? ''}
                maxLength={200}
                required={isNew}
                disabled={Boolean(card && card.cardKind !== 'FREE')}
              />
            </label>
            <label>
              {t('board.content')}
              <textarea
                name="content"
                defaultValue={card?.content ?? ''}
                maxLength={10000}
                disabled={Boolean(card && card.cardKind !== 'FREE')}
              />
            </label>
            {card && card.cardKind !== 'FREE' && (
              <p className="muted">{t('board.referenceContent')}</p>
            )}
            <TagComposer
              key={card?.cardId ?? 'new-card'}
              initialTags={card?.tags ?? []}
            />
            <label>
              {t('board.color')}
              <select name="color" defaultValue={card?.color ?? ''}>
                <option value="">{t('board.notSelected')}</option>
                {cardColors.map((color) => (
                  <option key={color} value={color}>
                    {t(`board.colors.${color}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('board.icon')}
              <select name="icon" defaultValue={card?.icon ?? ''}>
                <option value="">{t('board.notSelected')}</option>
                {cardIcons.map((icon) => (
                  <option key={icon} value={icon}>
                    {t(`board.icons.${icon}`)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={save.isPending}>{t('common.save')}</button>
      </form>
      {!isNew && (
        <div className="board-inspector-actions">
          {card && (
            <button
              type="button"
              className="button-ghost"
              onClick={() => card && onLinkStart(card.cardId)}
            >
              <Link2 aria-hidden="true" size={16} />
              {t('board.linkAction')}
            </button>
          )}
          <button
            className="button-danger"
            type="button"
            onClick={scheduleRemoval}
          >
            {t(card ? 'board.removeCard' : 'board.removeLink')}
          </button>
        </div>
      )}
    </aside>
  );
}

// Mutations run asynchronously, so the form is read while the submit event is still live.
function formData(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 30);
}

export function BoardPage() {
  const { campaignId } = useParams();
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorTarget>();
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [linking, setLinking] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string>();
  const [isPhone, setPhone] = useState(
    () => window.matchMedia?.('(max-width: 700px)').matches ?? false,
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 700px)');
    if (!media) return;
    const update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const board = useQuery({
    queryKey: ['board', campaignId],
    queryFn: () =>
      api.request<Board>(`/campaigns/${campaignId}/investigation-board`),
    enabled: Boolean(campaignId && campaign.data),
    retry: false,
  });
  const canManage =
    campaign.data?.currentUserRole === 'OWNER' ||
    campaign.data?.currentUserRole === 'PLAYER';
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BoardNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Layout saves that the server has not confirmed yet. A board refetch must
  // not move these cards back to their stale server position.
  const pendingLayout = useRef(new Map<string, NodeDimensions>());
  const updateNode = useMutation({
    mutationFn: ({
      cardId,
      dimensions,
    }: {
      cardId: string;
      dimensions: NodeDimensions;
    }) =>
      api.request(`/investigation-board/nodes/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify(dimensions),
      }),
    onMutate: ({ cardId, dimensions }) => {
      pendingLayout.current.set(cardId, dimensions);
    },
    onSuccess: (_result, { cardId, dimensions }) => {
      // Keep the cached snapshot in line with the saved layout.
      queryClient.setQueryData<Board>(
        ['board', campaignId],
        (current) =>
          current && {
            ...current,
            cards: current.cards.map((card) =>
              card.cardId === cardId ? { ...card, node: dimensions } : card,
            ),
          },
      );
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
    onSettled: (_result, _error, { cardId, dimensions }) => {
      if (pendingLayout.current.get(cardId) === dimensions)
        pendingLayout.current.delete(cardId);
    },
  });
  const persistNodeDimensions = useCallback(
    (cardId: string, dimensions: NodeDimensions) => {
      updateNode.mutate({ cardId, dimensions });
    },
    [updateNode.mutate],
  );

  // Reconcile server data with local React Flow state: keep the selection and
  // any unsaved local layout instead of replacing the nodes wholesale.
  useEffect(() => {
    if (!board.data) return;
    const nextNodes = boardNodes(
      board.data.cards,
      board.data.links,
      canManage,
      campaign.data?.newSinceAt,
      profile?.userId,
      persistNodeDimensions,
    );
    setNodes((current) => {
      const selected = new Set(
        current.filter((node) => node.selected).map((node) => node.id),
      );
      return nextNodes.map((node) => {
        const pending = pendingLayout.current.get(node.id);
        return {
          ...node,
          ...(pending && {
            position: { x: pending.x, y: pending.y },
            width: pending.width,
            height: pending.height,
          }),
          selected: canManage && selected.has(node.id),
        };
      });
    });
    const nextEdges = boardEdges(
      board.data.links,
      campaign.data?.newSinceAt,
      profile?.userId,
      t('ui.newMark'),
    );
    setEdges((current) => {
      const selected = new Set(
        current.filter((edge) => edge.selected).map((edge) => edge.id),
      );
      return nextEdges.map((edge) => ({
        ...edge,
        selected: canManage && selected.has(edge.id),
      }));
    });
  }, [
    board.data,
    canManage,
    campaign.data?.newSinceAt,
    profile?.userId,
    persistNodeDimensions,
    setEdges,
    setNodes,
    t,
  ]);
  const createLink = useMutation({
    mutationFn: (connection: Connection) =>
      api.request<BoardLink>(`/campaigns/${campaignId}/investigation-links`, {
        method: 'POST',
        body: JSON.stringify({
          cardAId: connection.source,
          cardBId: connection.target,
        }),
      }),
    onSuccess: () => {
      setError(undefined);
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
    },
    onError: (cause) => {
      setError(apiErrorMessage(cause, t));
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
    },
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      )
        return;
      setEdges((current) => addEdge(connection, current));
      createLink.mutate(connection);
      setLinking(false);
      setLinkSourceId(undefined);
    },
    [createLink, setEdges],
  );
  const onNodeDragStop = useCallback<OnNodeDrag<Node<BoardNodeData>>>(
    (_event, node) => {
      persistNodeDimensions(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: node.measured?.width ?? node.width ?? 240,
        height: node.measured?.height ?? node.height ?? 160,
      });
    },
    [persistNodeDimensions],
  );

  const data = campaign.data;
  const selectedCardId = nodes.find((node) => node.selected)?.id;
  const searchTerm = search.trim().toLocaleLowerCase('ru');
  const visibleNodes = nodes.map((node) => ({
    ...node,
    className: [
      node.className,
      selectedCardId &&
      node.id !== selectedCardId &&
      !board.data?.links.some(
        (link) =>
          (link.fromCardId === selectedCardId && link.toCardId === node.id) ||
          (link.toCardId === selectedCardId && link.fromCardId === node.id),
      )
        ? 'board-node-dimmed'
        : '',
      searchTerm &&
      !`${node.data.card.title} ${node.data.card.content || ''}`
        .toLocaleLowerCase('ru')
        .includes(searchTerm)
        ? 'board-node-dimmed'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  }));
  const visibleEdges = edges.map((edge) => ({
    ...edge,
    className: [
      selectedCardId
        ? edge.source === selectedCardId || edge.target === selectedCardId
          ? 'board-edge-connected'
          : 'board-edge-dimmed'
        : '',
      board.data?.links.some(
        (link) =>
          link.linkId === edge.id &&
          data?.newSinceAt &&
          link.createdAt &&
          link.createdAt > data.newSinceAt &&
          link.createdById !== profile?.userId,
      )
        ? 'board-edge-new'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  }));
  const background = useCampaignBackground(campaignId, data?.backgroundConfig);
  // A failed refresh keeps the last snapshot on screen; only a board that
  // never loaded is replaced by the page state.
  if (campaign.isError || (board.isError && !board.data))
    return (
      <PageError
        error={campaign.error ?? board.error ?? undefined}
        unavailableKey="workspace.boardUnavailable"
        onRetry={() => {
          void campaign.refetch();
          void board.refetch();
        }}
      />
    );
  const refreshError =
    board.isError && board.data ? errorMessage(board.error, t) : undefined;

  return (
    <CampaignWorkspaceShell campaign={data}>
      <div className="board-page">
        <section className="board-toolbar">
          <div>
            <h2>{t('board.title')}</h2>
            <p className="muted">
              {!canManage && <span>{t('board.readOnlyNotice')} · </span>}
              {board.dataUpdatedAt
                ? t('board.updatedAgo', {
                    count: Math.max(
                      0,
                      Math.floor((now - board.dataUpdatedAt) / 60000),
                    ),
                  })
                : t('common.loading')}{' '}
              ·{' '}
              <button
                className="board-refresh-link"
                onClick={() => void board.refetch()}
              >
                {t('board.refresh')}
              </button>
            </p>
          </div>
          <div className="action-row">
            <label className="board-search">
              <Search aria-hidden="true" size={16} />
              <span className="sr-only">{t('board.search')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('board.search')}
              />
            </label>
          </div>
        </section>
        {(error ?? refreshError) && (
          <p className="form-error" role="alert">
            {error ?? refreshError}
          </p>
        )}
        {board.data && !board.data.cards.length && (
          <div className="board-empty">
            <p>{t('workspace.boardEmpty')}</p>
          </div>
        )}
        {linking && <p className="board-link-hint">{t('board.linkHint')}</p>}
        {board.isLoading || campaign.isLoading ? (
          <section className="board-loading" aria-label={t('common.loading')}>
            <span />
            <span />
            <span />
          </section>
        ) : (
          <section
            className={`board-workspace ${editor ? 'board-workspace-inspecting' : ''}`}
          >
            <div
              className={`board-canvas ${canManage ? '' : 'board-canvas-readonly'}`}
            >
              <CampaignBackgroundLayer background={background} />
              <ReactFlow
                edges={visibleEdges}
                fitView
                nodes={visibleNodes}
                nodeTypes={nodeTypes}
                nodesConnectable={canManage && !isPhone}
                nodesDraggable={canManage && !isPhone}
                elementsSelectable
                // Deletion goes through the inspector; the shortcut would only remove the card locally.
                deleteKeyCode={null}
                onConnect={canManage && !isPhone ? onConnect : undefined}
                onEdgesChange={onEdgesChange}
                onEdgeClick={
                  canManage && !isPhone
                    ? (_event, edge) => {
                        const link = board.data?.links.find(
                          (item) => item.linkId === edge.id,
                        );
                        if (link) setEditor({ type: 'link', link });
                      }
                    : undefined
                }
                onNodeClick={
                  canManage && !isPhone
                    ? (_event, node) => {
                        if (linking) {
                          if (!linkSourceId) setLinkSourceId(node.id);
                          else if (linkSourceId !== node.id)
                            onConnect({
                              source: linkSourceId,
                              target: node.id,
                              sourceHandle: null,
                              targetHandle: null,
                            });
                          return;
                        }
                        setEditor({ type: 'card', card: node.data.card });
                      }
                    : undefined
                }
                onNodeDragStop={
                  canManage && !isPhone ? onNodeDragStop : undefined
                }
                onNodesChange={onNodesChange}
              >
                <BoardPattern />
                <Controls />
                <MiniMap />
                <BoardTools
                  canManage={Boolean(canManage)}
                  onNewCard={() => setEditor({ type: 'new-card' })}
                  linking={linking}
                  onLinkingChange={() => {
                    setLinkSourceId(undefined);
                    setLinking((value) => !value);
                  }}
                />
              </ReactFlow>
            </div>
            {canManage && editor && (
              <CardEditor
                target={editor}
                onClose={() => setEditor(undefined)}
                onLinkStart={(cardId) => {
                  setLinking(true);
                  setLinkSourceId(cardId);
                  setEditor(undefined);
                }}
              />
            )}
          </section>
        )}
      </div>
    </CampaignWorkspaceShell>
  );
}
