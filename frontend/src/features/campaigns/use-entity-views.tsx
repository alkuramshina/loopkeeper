import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError, Board, CampaignElement } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

export type ViewEntity = {
  entityType: 'ELEMENT' | 'BOARD_CARD' | 'BOARD_LINK';
  entityId: string;
};
const key = (entity: ViewEntity) => `${entity.entityType}:${entity.entityId}`;

export function boardEntities(board: Board): ViewEntity[] {
  return [
    ...board.cards.map((card) => ({
      entityType: 'BOARD_CARD' as const,
      entityId: card.cardId,
    })),
    ...board.links.map((link) => ({
      entityType: 'BOARD_LINK' as const,
      entityId: link.linkId,
    })),
  ];
}

// A transient failure gets exactly one automatic retry of the same payload.
export async function postViews(
  request: (entities: ViewEntity[]) => Promise<unknown>,
  entities: ViewEntity[],
) {
  try {
    await request(entities);
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) throw error;
    await request(entities);
  }
}

export function ViewSaveStatus({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation();
  if (!failed) return null;
  return (
    <p className="notice" role="status">
      {t('views.saveFailed')}{' '}
      <button className="material-link-button" type="button" onClick={retry}>
        {t('common.retry')}
      </button>
    </p>
  );
}

export function useElementView(element: CampaignElement) {
  const { api } = useAuth();
  const apiRef = useRef(api);
  apiRef.current = api;
  const client = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const completed = useRef(new Set<string>());
  const pending = useRef(new Map<string, Promise<void>>());
  useEffect(() => {
    let active = true;
    const id = element.elementId;
    if (completed.current.has(id)) return;
    setFailed(false);
    setUnavailable(false);
    const request = (entities: ViewEntity[]) =>
      apiRef.current.request(`/campaigns/${element.campaignId}/views`, {
        method: 'POST',
        body: JSON.stringify({ entities }),
      });
    let saving = pending.current.get(id);
    if (!saving) {
      saving = postViews(request, [{ entityType: 'ELEMENT', entityId: id }]);
      pending.current.set(id, saving);
    }
    void saving
      .then(() => {
        if (completed.current.has(id)) return;
        completed.current.add(id);
        client.setQueryData<CampaignElement>(
          ['element', id],
          (current) => current && { ...current, isNew: false },
        );
        client.setQueriesData<CampaignElement[]>(
          { queryKey: ['elements', element.campaignId] },
          (current) =>
            current?.map((item) =>
              item.elementId === id ? { ...item, isNew: false } : item,
            ),
        );
        void client.invalidateQueries({
          queryKey: ['campaign', element.campaignId],
        });
        void client.invalidateQueries({ queryKey: ['campaigns'] });
      })
      .catch(async (error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          try {
            await client.fetchQuery({
              queryKey: ['element', id],
              queryFn: () =>
                apiRef.current.request<CampaignElement>(`/elements/${id}`),
              staleTime: 0,
              retry: false,
            });
          } catch (detailError) {
            if (
              active &&
              detailError instanceof ApiError &&
              detailError.status === 404
            ) {
              setUnavailable(true);
              return;
            }
          }
        }
        if (active) setFailed(true);
      })
      .finally(() => {
        pending.current.delete(id);
      });
    return () => {
      active = false;
    };
  }, [client, element.elementId, element.campaignId, attempt]);
  return { failed, unavailable, retry: () => setAttempt((value) => value + 1) };
}

export function useBoardViews(
  campaignId: string | undefined,
  board: Board | undefined,
  renderedIds: Set<string>,
) {
  const { api } = useAuth();
  const apiRef = useRef(api);
  apiRef.current = api;
  const client = useQueryClient();
  const tracked = useRef(new Set<string>());
  const failures = useRef<ViewEntity[][]>([]);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [highlight, setHighlight] = useState(new Set<string>());
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState(0);

  useEffect(() => {
    tracked.current.clear();
    failures.current = [];
    setHighlight(new Set());
    setFailed(false);
    setUnavailable(false);
    return () => {
      generation.current++;
    };
  }, [campaignId]);

  const send = useCallback(
    async (entities: ViewEntity[], currentGeneration: number) => {
      const request = (batch: ViewEntity[]) =>
        apiRef.current.request(`/campaigns/${campaignId}/views`, {
          method: 'POST',
          body: JSON.stringify({ entities: batch }),
        });
      try {
        try {
          await postViews(request, entities);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
          const fresh = await apiRef.current.request<Board>(
            `/campaigns/${campaignId}/investigation-board`,
          );
          if (currentGeneration !== generation.current) return;
          client.setQueryData(['board', campaignId], fresh);
          const visible = new Set(boardEntities(fresh).map(key));
          const remaining = entities.filter((entity) =>
            visible.has(key(entity)),
          );
          if (remaining.length) await postViews(request, remaining);
        }
      } catch (error) {
        if (currentGeneration !== generation.current) return;
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          error.code === 'campaign.not_found'
        )
          setUnavailable(true);
        failures.current.push(entities);
        setFailed(true);
      }
    },
    [campaignId, client],
  );

  useEffect(() => {
    if (!board || !campaignId) return;
    const all = boardEntities(board);
    // Reconciliation must have committed every card and link before marking the response.
    if (!all.every((entity) => renderedIds.has(entity.entityId))) return;
    const visible = new Set(all.map((entity) => entity.entityId));
    const added = all.filter((entity) => !tracked.current.has(key(entity)));
    for (const entity of added) tracked.current.add(key(entity));
    setHighlight((previous) => {
      const next = new Set([...previous].filter((id) => visible.has(id)));
      const addedIds = new Set(added.map((entity) => entity.entityId));
      for (const card of board.cards)
        if (addedIds.has(card.cardId) && card.isNew) next.add(card.cardId);
      for (const link of board.links)
        if (addedIds.has(link.linkId) && link.isNew) next.add(link.linkId);
      return next.size === previous.size &&
        [...next].every((id) => previous.has(id))
        ? previous
        : next;
    });
    for (let i = 0; i < added.length; i += 500)
      void send(added.slice(i, i + 500), generation.current);
  }, [board, campaignId, renderedIds, send, snapshot]);

  const reset = useCallback(() => {
    // The freshly fetched snapshot repeats failed entries safely.
    generation.current++;
    tracked.current.clear();
    failures.current = [];
    setFailed(false);
    setHighlight(new Set());
    setSnapshot((value) => value + 1);
  }, []);
  const retry = () => {
    const batches = failures.current.splice(0);
    setFailed(false);
    for (const batch of batches) void send(batch, generation.current);
  };
  return { highlight, failed, unavailable, retry, reset };
}
