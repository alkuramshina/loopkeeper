import { characterSheet } from '../characters/tales-from-the-loop';
import { useBoardViews, ViewSaveStatus } from './use-entity-views';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  Connection,
  ConnectionMode,
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
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  Board,
  BoardCard,
  BoardLink,
  Campaign,
  CampaignElement,
  Character,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ProtectedImage } from '../../components/protected-image';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { errorMessage, PageError } from '../../components/page-error';
import { formText } from '../../components/form-text';
import { TypeTag } from '../../components/ui/type-tag';
import { NewMark } from '../../components/ui/new-mark';
import { AccessBadge } from '../../components/ui/access-badge';
import { useToast } from '../../components/ui/toast';
import {
  mediaQueries,
  prefersReducedMotion,
  useMediaQuery,
} from '../../theme/breakpoints';
import { ArrowUpRight, Maximize2, Plus, Search } from 'lucide-react';

type NodeDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type BoardNodeData = {
  card: BoardCard;
  conditions: string[];
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

/** Default grid slot for the n-th card when it has no saved layout. */
function defaultSlot(index: number) {
  return {
    x: 80 + (index % 4) * 280,
    y: 80 + Math.floor(index / 4) * 210,
  };
}

function cardTypeTag(card: BoardCard) {
  return card.reference?.kind === 'CHARACTER'
    ? 'CHARACTER'
    : card.reference?.type || 'OTHER';
}

/** Links are undirected, so A–B and B–A are the same pair. */
function sameCardPair(
  a: { source: string; target: string },
  b: { source: string; target: string },
) {
  return (
    (a.source === b.source && a.target === b.target) ||
    (a.source === b.target && a.target === b.source)
  );
}

function boardNodes(
  cards: BoardCard[],
  links: BoardLink[],
  canManage: boolean,
  highlight: Set<string>,
  characterConditions: Map<string, string[]>,
  onResizeEnd: (cardId: string, dimensions: NodeDimensions) => void,
): Node<BoardNodeData>[] {
  return cards.map((card, index) => ({
    id: card.cardId,
    type: 'card',
    position: card.node
      ? { x: card.node.x, y: card.node.y }
      : defaultSlot(index),
    width: card.node?.width ?? 240,
    height: card.node?.height ?? 160,
    data: {
      card,
      conditions:
        characterConditions.get(card.reference?.characterId ?? '') ?? [],
      isNew: highlight.has(card.cardId),
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
  highlight: Set<string>,
  newLabel?: string,
): Edge[] {
  const pathStrategy: Edge['type'] = 'default';
  return links.map((link) => ({
    id: link.linkId,
    source: link.fromCardId,
    target: link.toCardId,
    label: highlight.has(link.linkId)
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
    <article
      className={[
        'flow-card',
        selected ? 'selected' : '',
        card.color ? `board-color-${card.color}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <NodeResizer
        isVisible={selected && data.canManage}
        maxHeight={2000}
        maxWidth={2000}
        minHeight={60}
        minWidth={80}
        onResizeEnd={(_event, dimensions) => data.onResizeEnd(dimensions)}
      />
      {/* Links are undirected: in loose mode either point starts or takes one. */}
      <Handle id="top" type="source" position={Position.Top} />
      {card.reference?.coverUrl && (
        <ProtectedImage
          alt=""
          className="flow-card-cover"
          draggable={false}
          imageUrl={card.reference.coverUrl}
        />
      )}
      {/* A free card is the default; only materials name their type. */}
      {(data.isNew || card.cardKind !== 'FREE') && (
        <div className="flow-card-top">
          {data.isNew && <NewMark />}
          {card.cardKind !== 'FREE' && <TypeTag type={cardTypeTag(card)} />}
        </div>
      )}
      {card.color && (
        <span className="sr-only">{t(`board.colors.${card.color}`)}</span>
      )}
      <h3>{card.title}</h3>
      {card.content && <p className="flow-card-preview">{card.content}</p>}
      {data.conditions.length > 0 && (
        <div className="flow-card-conditions">
          {data.conditions.map((condition) => (
            <span key={condition}>{condition}</span>
          ))}
        </div>
      )}
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
      {card.reference?.kind === 'CHARACTER' && card.reference.characterId && (
        <Link
          className="flow-card-source nodrag"
          to={`/campaigns/${campaignId}/characters/${card.reference.characterId}`}
          aria-label={t('board.openSource')}
          onClick={(event) => event.stopPropagation()}
        >
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      )}
      <Handle id="bottom" type="source" position={Position.Bottom} />
    </article>
  );
}

const nodeTypes = { card: InvestigationCard };

const cardColors = ['ochre', 'rose', 'blue', 'olive', 'grey'] as const;
const cardIcons = ['clue', 'person', 'place', 'question', 'warning'];

function BoardTools({
  canManage,
  onNewCard,
}: {
  canManage: boolean;
  onNewCard: () => void;
}) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="board-tools">
      {canManage && (
        <button type="button" onClick={onNewCard}>
          <Plus aria-hidden="true" size={16} />
          {t('board.cardAction')}
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          void fitView({
            duration: prefersReducedMotion() ? 0 : 250,
            padding: 0.15,
          })
        }
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

/** Shared materials that are not on the board yet, to add as reference cards. */
function MaterialPicker({
  onPick,
  pending,
}: {
  onPick: (element: CampaignElement) => void;
  pending: boolean;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const elements = useQuery({
    queryKey: ['elements', campaignId],
    queryFn: () =>
      api.request<CampaignElement[]>(`/campaigns/${campaignId}/elements`),
  });
  const onBoard = new Set(
    queryClient
      .getQueryData<Board>(['board', campaignId])
      ?.cards.map((card) => card.reference?.elementId)
      .filter(Boolean),
  );
  const term = query.trim().toLocaleLowerCase('ru');
  const available = (elements.data ?? []).filter(
    (element) =>
      element.access === 'SHARED' &&
      !onBoard.has(element.elementId) &&
      element.title.toLocaleLowerCase('ru').includes(term),
  );
  return (
    <div className="board-material-picker">
      <label>
        {t('board.materialSearch')}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('board.materialSearchPlaceholder')}
        />
      </label>
      {elements.isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : elements.isError ? (
        <p className="form-error" role="alert">
          {apiErrorMessage(elements.error, t)}
        </p>
      ) : available.length ? (
        <ul>
          {available.map((element) => (
            <li key={element.elementId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick(element)}
              >
                <TypeTag type={element.type} />
                <span>{element.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {t(term ? 'board.materialsNotFound' : 'board.materialsEmpty')}
        </p>
      )}
    </div>
  );
}

function CardEditor({
  target,
  onClose,
}: {
  target: EditorTarget;
  onClose: () => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [newCardSource, setNewCardSource] = useState<'free' | 'material'>(
    'free',
  );
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
      if (isNew) await placeNewCard(result as BoardCard);
      await queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const addMaterial = useMutation({
    mutationFn: (element: CampaignElement) =>
      api.request<BoardCard>(`/campaigns/${campaignId}/cards`, {
        method: 'POST',
        body: JSON.stringify({
          cardKind: 'ELEMENT_REFERENCE',
          elementId: element.elementId,
        }),
      }),
    onSuccess: async (newCard) => {
      await placeNewCard(newCard);
      await queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  async function placeNewCard(newCard: BoardCard) {
    const current = queryClient.getQueryData<Board>(['board', campaignId]);
    try {
      await api.request(`/investigation-board/nodes/${newCard.cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...defaultSlot(current?.cards.length ?? 0),
          width: 240,
          height: 160,
        }),
      });
    } catch {
      // The card itself was created. It remains usable with the board's default position.
    }
  }
  function scheduleCardRemoval() {
    if (!card) return;
    const commitRemoval = () => {
      void api
        .request<void>(`/cards/${card.cardId}`, { method: 'DELETE' })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ['board', campaignId] }),
        )
        .catch((cause) => toast.show({ message: apiErrorMessage(cause, t) }));
    };
    toast.show({
      message: t('board.cardRemoved'),
      onUndo: () => undefined,
      onExpire: commitRemoval,
    });
    onClose();
  }
  // A link is cheap to draw again, so it goes at once; the toast only reports it.
  function removeLink() {
    if (!link) return;
    queryClient.setQueryData<Board>(
      ['board', campaignId],
      (current) =>
        current && {
          ...current,
          links: current.links.filter((item) => item.linkId !== link.linkId),
        },
    );
    void api
      .request<void>(`/investigation-links/${link.linkId}`, {
        method: 'DELETE',
      })
      .then(() => toast.show({ message: t('board.linkRemoved') }))
      .catch((cause) => toast.show({ message: apiErrorMessage(cause, t) }))
      .finally(
        () =>
          void queryClient.invalidateQueries({
            queryKey: ['board', campaignId],
          }),
      );
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
          {card.cardKind !== 'FREE' && <TypeTag type={cardTypeTag(card)} />}
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
      {isNew && (
        <div
          className="board-card-source"
          role="radiogroup"
          aria-label={t('board.newCardSource')}
        >
          {(['free', 'material'] as const).map((source) => (
            <button
              key={source}
              type="button"
              role="radio"
              aria-checked={newCardSource === source}
              onClick={() => {
                setError(undefined);
                setNewCardSource(source);
              }}
            >
              {t(`board.newCardSources.${source}`)}
            </button>
          ))}
        </div>
      )}
      {isNew && newCardSource === 'material' ? (
        <>
          <MaterialPicker
            onPick={(element) => addMaterial.mutate(element)}
            pending={addMaterial.isPending}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
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
      )}
      {!isNew && (
        <div className="board-inspector-actions">
          <button
            className="button-danger"
            type="button"
            onClick={card ? scheduleCardRemoval : removeLink}
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
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorTarget>();
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const isPhone = useMediaQuery(mediaQueries.phone);
  // React Flow's own labels and hints for assistive technology.
  const ariaLabelConfig = useMemo(
    () => ({
      'controls.ariaLabel': t('board.a11y.controls'),
      'controls.zoomIn.ariaLabel': t('board.a11y.zoomIn'),
      'controls.zoomOut.ariaLabel': t('board.a11y.zoomOut'),
      'controls.fitView.ariaLabel': t('board.a11y.fitView'),
      'controls.interactive.ariaLabel': t('board.a11y.interactive'),
      'minimap.ariaLabel': t('board.a11y.minimap'),
      'handle.ariaLabel': t('board.a11y.handle'),
      'node.a11yDescription.default': t('board.a11y.nodeSelect'),
      'node.a11yDescription.keyboardDisabled': t('board.a11y.nodeMove'),
      'edge.a11yDescription.default': t('board.a11y.edgeSelect'),
      'node.a11yDescription.ariaLiveMessage': ({
        direction,
        x,
        y,
      }: {
        direction: string;
        x: number;
        y: number;
      }) =>
        t('board.a11y.moved', {
          direction: t(`board.a11y.directions.${direction}`, {
            defaultValue: direction,
          }),
          x: Math.round(x),
          y: Math.round(y),
        }),
    }),
    [t],
  );
  // Below 1024px the search folds into an icon until it is used.
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
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
  const hasCharacterCards =
    board.data?.cards.some((card) => card.reference?.kind === 'CHARACTER') ??
    false;
  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () =>
      api.request<Character[]>(`/campaigns/${campaignId}/characters`),
    enabled: hasCharacterCards,
    retry: false,
  });
  const sheet = characterSheet(campaign.data?.system);
  useEffect(() => {
    const cardId = searchParams.get('card');
    const card = board.data?.cards.find((item) => item.cardId === cardId);
    if (card) setEditor({ type: 'card', card });
  }, [board.data, searchParams]);
  const canManage =
    campaign.data?.currentUserRole === 'OWNER' ||
    campaign.data?.currentUserRole === 'PLAYER';
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BoardNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const renderedIds = useMemo(
    () =>
      new Set([
        ...nodes.map((node) => node.id),
        ...edges.map((edge) => edge.id),
      ]),
    [nodes, edges],
  );
  const views = useBoardViews(campaignId, board.data, renderedIds);

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
    const characterConditions = new Map<string, string[]>();
    for (const character of characters.data ?? []) {
      const fields = sheet?.fields ?? [];
      characterConditions.set(
        character.characterId,
        fields
          .filter(
            (field) =>
              field.section === 'conditions' &&
              field.type === 'boolean' &&
              character.data[field.key] === true,
          )
          .map((field) =>
            t(`case.character.condition.${field.key}`, {
              defaultValue: field.label,
            }),
          ),
      );
    }
    const nextNodes = boardNodes(
      board.data.cards,
      board.data.links,
      canManage,
      views.highlight,
      characterConditions,
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
      views.highlight,
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
    views.highlight,
    characters.data,
    sheet,
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
      // 409: someone already linked the pair; the refetch simply shows it.
      if (!(cause instanceof ApiError && cause.status === 409))
        setError(apiErrorMessage(cause, t));
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
    },
  });

  // One link per pair of cards, whichever end the drag started from.
  const isValidConnection = useCallback(
    (connection: Edge | Connection) =>
      connection.source !== connection.target &&
      !edges.some((edge) => sameCardPair(edge, connection)),
    [edges],
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      setEdges((current) => addEdge(connection, current));
      createLink.mutate(connection);
    },
    [createLink, isValidConnection, setEdges],
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

  const linkedCardId = searchParams.get('card');
  const selectedCardId =
    nodes.find((node) => node.id === linkedCardId)?.id ??
    nodes.find((node) => node.selected)?.id;
  const searchTerm = search.trim().toLocaleLowerCase('ru');
  const visibleNodes = nodes.map((node) => ({
    ...node,
    className: [
      node.className,
      node.id === linkedCardId ? 'board-node-search-target' : '',
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
  const nodeCenterY = new Map(
    nodes.map((node) => [
      node.id,
      node.position.y + (node.measured?.height ?? node.height ?? 0) / 2,
    ]),
  );
  const visibleEdges = edges.map((edge) => {
    // Stored links have no direction, so each line leaves the lower edge of
    // the upper card and enters the upper edge of the lower one.
    const sourceAbove =
      (nodeCenterY.get(edge.source) ?? 0) <=
      (nodeCenterY.get(edge.target) ?? 0);
    return {
      ...edge,
      sourceHandle: sourceAbove ? 'bottom' : 'top',
      targetHandle: sourceAbove ? 'top' : 'bottom',
      className: [
        selectedCardId
          ? edge.source === selectedCardId || edge.target === selectedCardId
            ? 'board-edge-connected'
            : 'board-edge-dimmed'
          : '',
        board.data?.links.some(
          (link) => link.linkId === edge.id && views.highlight.has(link.linkId),
        )
          ? 'board-edge-new'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    };
  });
  // A failed refresh keeps the last snapshot on screen; only a board that
  // never loaded is replaced by the page state.
  if (views.unavailable || campaign.isError || (board.isError && !board.data))
    return (
      <PageError
        inline
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
    <>
      <div className="board-page">
        <PageHeader
          compact
          meta={
            <>
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
                type="button"
                className="board-refresh-link"
                aria-describedby="board-refresh-hint"
                onClick={() =>
                  void board.refetch().then((result) => {
                    if (result.isSuccess) views.reset();
                  })
                }
              >
                {t('board.refresh')}
              </button>{' '}
              <span id="board-refresh-hint">{t('board.refreshHint')}</span>
            </>
          }
          title={t('board.title')}
          actions={
            <>
              <button
                aria-expanded={searchExpanded || Boolean(search)}
                aria-label={t('board.search')}
                className="board-search-toggle"
                type="button"
                onClick={() => {
                  setSearchExpanded(true);
                  // The field appears in this click; focus it once it is shown.
                  requestAnimationFrame(() => searchInput.current?.focus());
                }}
              >
                <Search aria-hidden="true" size={18} />
              </button>
              <label
                className={`board-search${searchExpanded || search ? ' board-search-expanded' : ''}`}
              >
                <Search aria-hidden="true" size={16} />
                <span className="sr-only">{t('board.search')}</span>
                <input
                  ref={searchInput}
                  value={search}
                  onBlur={() => setSearchExpanded(false)}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('board.search')}
                />
              </label>
            </>
          }
        />
        <ViewSaveStatus failed={views.failed} retry={views.retry} />
        {(error ?? refreshError) && (
          <p className="form-error" role="alert">
            {error ?? refreshError}
          </p>
        )}
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
              {board.data && !board.data.cards.length && !editor && (
                // In the middle of the empty board, with its one action.
                <div className="board-empty">
                  <p>{t('workspace.boardEmpty')}</p>
                  {canManage && (
                    <Button
                      icon={Plus}
                      onClick={() => setEditor({ type: 'new-card' })}
                      variant="primary"
                    >
                      {t('board.newCard')}
                    </Button>
                  )}
                </div>
              )}
              <ReactFlow
                ariaLabelConfig={ariaLabelConfig}
                edges={visibleEdges}
                fitView
                nodes={visibleNodes}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                isValidConnection={isValidConnection}
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
                    ? (_event, node) =>
                        setEditor({ type: 'card', card: node.data.card })
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
                />
              </ReactFlow>
            </div>
            {canManage && editor && (
              <CardEditor
                target={editor}
                onClose={() => setEditor(undefined)}
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}
