import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  OnNodeDrag,
  NodeResizer,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams } from 'react-router-dom';
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

type NodeDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type BoardNodeData = {
  card: BoardCard;
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
  canManage: boolean,
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
      canManage,
      onResizeEnd: (dimensions) => onResizeEnd(card.cardId, dimensions),
    },
  }));
}

function boardEdges(links: BoardLink[]): Edge[] {
  return links.map((link) => ({
    id: link.linkId,
    source: link.fromCardId,
    target: link.toCardId,
    label: link.label,
    type: 'smoothstep',
  }));
}

function InvestigationCard({ data, selected }: NodeProps<Node<BoardNodeData>>) {
  const { t } = useTranslation();
  const { card } = data;
  return (
    <article
      className={`flow-card ${selected ? 'selected' : ''}`}
      style={{ borderLeftColor: card.color ?? undefined }}
    >
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
      <p className="kicker">{t(`board.cardKinds.${card.cardKind}`)}</p>
      <h3>{card.title}</h3>
      {card.content && <p>{card.content}</p>}
      {card.tags.length > 0 && (
        <small>{card.tags.map((tag) => `#${tag}`).join(' ')}</small>
      )}
      <Handle type="source" position={Position.Bottom} />
    </article>
  );
}

const nodeTypes = { card: InvestigationCard };

const cardColors = ['#6d1f25', '#c36b3d', '#39726a', '#436b9c', '#6e5a92'];
const cardIcons = ['clue', 'person', 'place', 'question', 'warning'];

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
}: {
  target: EditorTarget;
  onClose: () => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const isNew = target.type === 'new-card';
  const card = target.type === 'card' ? target.card : undefined;
  const link = target.type === 'link' ? target.link : undefined;
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
  const remove = useMutation({
    mutationFn: () =>
      api.request<void>(
        card ? `/cards/${card.cardId}` : `/investigation-links/${link?.linkId}`,
        { method: 'DELETE' },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  const heading = isNew
    ? t('board.newCard')
    : card
      ? t('board.editCard')
      : t('board.editLink');
  return (
    <aside className="board-inspector panel">
      <div className="section-heading">
        <h2>{heading}</h2>
        <button className="button-ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
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
                    {color}
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
        <button
          className="button-danger"
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (
              window.confirm(
                t(
                  card
                    ? 'board.deleteCardConfirmation'
                    : 'board.deleteLinkConfirmation',
                ),
              )
            )
              remove.mutate();
          }}
        >
          {t('common.delete')}
        </button>
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
      canManage,
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
    const nextEdges = boardEdges(board.data.links);
    setEdges((current) => {
      const selected = new Set(
        current.filter((edge) => edge.selected).map((edge) => edge.id),
      );
      return nextEdges.map((edge) => ({
        ...edge,
        selected: canManage && selected.has(edge.id),
      }));
    });
  }, [board.data, canManage, persistNodeDimensions, setEdges, setNodes]);
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
              {t(canManage ? 'board.restNotice' : 'board.readOnlyNotice')}
            </p>
          </div>
          <div className="action-row">
            <button
              className="button-ghost"
              onClick={() => void board.refetch()}
            >
              {t('board.refresh')}
            </button>
            {canManage && (
              <button onClick={() => setEditor({ type: 'new-card' })}>
                {t('board.newCard')}
              </button>
            )}
          </div>
        </section>
        {(error ?? refreshError) && (
          <p className="form-error" role="alert">
            {error ?? refreshError}
          </p>
        )}
        {board.data && !board.data.cards.length && (
          <p className="muted">{t('workspace.boardEmpty')}</p>
        )}
        {board.isLoading || campaign.isLoading ? (
          <section className="board-loading" aria-label={t('common.loading')}>
            <span />
            <span />
            <span />
          </section>
        ) : (
          <section className="board-workspace">
            <div
              className={`board-canvas ${canManage ? '' : 'board-canvas-readonly'}`}
            >
              <CampaignBackgroundLayer background={background} />
              <ReactFlow
                edges={edges}
                fitView
                nodes={nodes}
                nodeTypes={nodeTypes}
                nodesConnectable={canManage}
                nodesDraggable={canManage}
                elementsSelectable={canManage}
                // Deletion goes through the inspector with a confirmation;
                // the shortcut would only remove the card locally.
                deleteKeyCode={null}
                onConnect={canManage ? onConnect : undefined}
                onEdgesChange={onEdgesChange}
                onEdgeClick={
                  canManage
                    ? (_event, edge) => {
                        const link = board.data?.links.find(
                          (item) => item.linkId === edge.id,
                        );
                        if (link) setEditor({ type: 'link', link });
                      }
                    : undefined
                }
                onNodeClick={
                  canManage
                    ? (_event, node) =>
                        setEditor({ type: 'card', card: node.data.card })
                    : undefined
                }
                onNodeDragStop={canManage ? onNodeDragStop : undefined}
                onNodesChange={onNodesChange}
              >
                <Background gap={20} />
                <Controls />
                <MiniMap />
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
    </CampaignWorkspaceShell>
  );
}
