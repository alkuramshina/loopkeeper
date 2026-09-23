import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
import { TFunction } from 'i18next';
import {
  ApiError,
  Board,
  BoardCard,
  BoardLink,
  Campaign,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import {
  CampaignBackgroundLayer,
  useCampaignBackground,
} from './use-campaign-background';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

type NodeDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type BoardNodeData = {
  card: BoardCard;
  onResizeEnd: (dimensions: NodeDimensions) => void;
};
type EditorTarget =
  | { type: 'card'; card: BoardCard }
  | { type: 'link'; link: BoardLink }
  | { type: 'new-card' };

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function boardNodes(
  cards: BoardCard[],
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
        isVisible={selected}
        maxHeight={2000}
        maxWidth={2000}
        minHeight={60}
        minWidth={80}
        onResizeEnd={(_event, dimensions) => data.onResizeEnd(dimensions)}
      />
      <Handle type="target" position={Position.Top} />
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
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (isNew) {
        return api.request<BoardCard>(`/campaigns/${campaignId}/cards`, {
          method: 'POST',
          body: JSON.stringify({
            cardKind: 'FREE',
            title: String(form.get('title') ?? ''),
            content: String(form.get('content') ?? '') || undefined,
            tags: parseTags(String(form.get('tags') ?? '')),
            color: String(form.get('color') ?? '') || undefined,
            icon: String(form.get('icon') ?? '') || undefined,
          }),
        });
      }
      if (card) {
        return api.request<BoardCard>(`/cards/${card.cardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(card.cardKind === 'FREE'
              ? {
                  title: String(form.get('title') ?? ''),
                  content: String(form.get('content') ?? '') || undefined,
                }
              : {}),
            tags: parseTags(String(form.get('tags') ?? '')),
            color: String(form.get('color') ?? '') || undefined,
            icon: String(form.get('icon') ?? '') || undefined,
          }),
        });
      }
      return api.request<BoardLink>(`/investigation-links/${link?.linkId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: String(form.get('label') ?? '') || undefined,
        }),
      });
    },
    onSuccess: async (result) => {
      if (isNew && campaignId) {
        const current = queryClient.getQueryData<Board>(['board', campaignId]);
        const index = current?.cards.length ?? 0;
        const newCard = result as BoardCard;
        await api.request(`/investigation-board/nodes/${newCard.cardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            x: 80 + (index % 4) * 280,
            y: 80 + Math.floor(index / 4) * 210,
            width: 240,
            height: 160,
          }),
        });
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
      <form onSubmit={(event) => save.mutate(event)}>
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
              {t('board.title')}
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
            <label>
              {t('board.tags')}
              <input
                name="tags"
                defaultValue={card?.tags.join(', ') ?? ''}
                maxLength={1529}
              />
            </label>
            <label>
              {t('board.color')}
              <input
                name="color"
                defaultValue={card?.color ?? ''}
                pattern="#[0-9a-fA-F]{3,8}"
                placeholder="#6d1f25"
              />
            </label>
            <label>
              {t('board.icon')}
              <input
                name="icon"
                defaultValue={card?.icon ?? ''}
                pattern="[a-z0-9-]{1,40}"
              />
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

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 30);
}

export function BoardPage() {
  const { campaignId } = useParams();
  const { api, profile, signOut } = useAuth();
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
    enabled: Boolean(campaignId) && campaign.data?.currentUserRole !== 'VIEWER',
    retry: false,
  });
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BoardNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const persistNodeDimensions = useCallback(
    (cardId: string, dimensions: NodeDimensions) => {
      updateNode.mutate({ cardId, dimensions });
    },
    [updateNode.mutate],
  );

  useEffect(() => {
    if (!board.data) return;
    setNodes(boardNodes(board.data.cards, persistNodeDimensions));
    setEdges(boardEdges(board.data.links));
  }, [board.data, persistNodeDimensions, setEdges, setNodes]);
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
  const background = useCampaignBackground(
    campaignId,
    data?.backgroundConfig,
    data?.currentUserRole,
  );
  if (campaign.isError || board.isError || data?.currentUserRole === 'VIEWER')
    return (
      <main className="page-state" role="alert">
        {t('workspace.boardUnavailable')}
      </main>
    );
  const canManage =
    data?.currentUserRole === 'OWNER' || data?.currentUserRole === 'PLAYER';

  return (
    <CampaignWorkspaceShell campaign={data}>
      <div className="board-page">
        <section className="board-toolbar">
          <div>
            <h2>{t('board.title')}</h2>
            <p className="muted">{t('board.restNotice')}</p>
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
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {board.isLoading || campaign.isLoading ? (
          <section className="board-loading" aria-label={t('common.loading')}>
            <span />
            <span />
            <span />
          </section>
        ) : (
          <section className="board-workspace">
            <div className="board-canvas">
              {(data?.currentUserRole === 'OWNER' ||
                data?.currentUserRole === 'PLAYER') && (
                <CampaignBackgroundLayer background={background} />
              )}
              <ReactFlow
                edges={edges}
                fitView
                nodes={nodes}
                nodeTypes={nodeTypes}
                nodesConnectable={canManage}
                nodesDraggable={canManage}
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
