import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, Board, CampaignElement } from '../../api/client';
import {
  boardEntities,
  useBoardViews,
  useElementView,
} from './use-entity-views';

const request = vi.fn();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ api: { request } }),
}));
const item: CampaignElement = {
  isNew: true,
  elementId: 'e',
  campaignId: 'c',
  type: 'NOTE',
  access: 'SHARED',
  title: 'A clue',
  content: '',
  imageUrl: null,
  typeData: {},
  createdAt: '',
  updatedAt: '',
  createdById: 'other',
  createdBy: { userId: 'other', name: null },
};
const boardWith = (count: number): Board => ({
  boardId: 'b',
  links: [],
  cards: Array.from({ length: count }, (_, i) => ({
    cardId: `card-${i}`,
    isNew: true,
    cardKind: 'FREE',
    title: `Card ${i}`,
    createdAt: '',
    createdBy: { userId: 'other', name: null },
    tags: [],
  })),
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  request.mockReset();
});
describe('Element view persistence', () => {
  it('updates detail and every list cache only after success, then refreshes counts', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(['element', 'e'], item);
    client.setQueryData(['elements', 'c'], [item]);
    client.setQueryData(['elements', 'c', 'NOTE'], [item]);
    request.mockResolvedValue(undefined);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useElementView(item), { wrapper });
    await waitFor(() =>
      expect(
        client.getQueryData<CampaignElement>(['element', 'e'])?.isNew,
      ).toBe(false),
    );
    expect(
      client.getQueryData<CampaignElement[]>(['elements', 'c', 'NOTE'])?.[0]
        .isNew,
    ).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['campaign', 'c'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['campaigns'] });
  });
  it('retries a transient failure once and keeps the status until a manual retry succeeds', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(['element', 'e'], item);
    request.mockRejectedValue(new TypeError('Offline'));
    const { result } = renderHook(() => useElementView(item), { wrapper });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
    expect(client.getQueryData<CampaignElement>(['element', 'e'])?.isNew).toBe(
      true,
    );
    request.mockResolvedValue(undefined);
    act(() => result.current.retry());
    await waitFor(() =>
      expect(
        client.getQueryData<CampaignElement>(['element', 'e'])?.isNew,
      ).toBe(false),
    );
  });
  it('rereads detail on 404 and shows the neutral unavailable state', async () => {
    const { wrapper } = setup();
    request.mockImplementation(() => {
      return Promise.reject(
        new ApiError(404, 'resource.not_found', 'Unavailable', undefined),
      );
    });
    const { result } = renderHook(() => useElementView(item), { wrapper });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe('/elements/e');
  });
});
describe('Board view snapshots', () => {
  it('waits for rendered IDs, chunks at 500, preserves highlights through refetch and retries only failed batches', async () => {
    const { wrapper } = setup();
    const board = boardWith(502);
    request.mockImplementation((_path: string, init: RequestInit) => {
      const entities = JSON.parse(init.body as string).entities;
      return entities.length === 2
        ? Promise.reject(
            new ApiError(503, 'internal.error', 'Unavailable', undefined),
          )
        : Promise.resolve(undefined);
    });
    const { result, rerender } = renderHook(
      ({ snapshot, rendered }) => useBoardViews('c', snapshot, rendered),
      {
        wrapper,
        initialProps: { snapshot: board, rendered: new Set<string>() },
      },
    );
    expect(request).not.toHaveBeenCalled();
    const rendered = new Set(board.cards.map((card) => card.cardId));
    rerender({ snapshot: board, rendered });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(
      request.mock.calls.map(
        (call) => JSON.parse(call[1].body).entities.length,
      ),
    ).toEqual([500, 2, 2]);
    expect(result.current.highlight.size).toBe(502);
    const viewed = {
      ...board,
      cards: board.cards.map((card) => ({ ...card, isNew: false })),
    };
    rerender({ snapshot: viewed, rendered });
    expect(result.current.highlight.size).toBe(502);
    request.mockResolvedValue(undefined);
    act(() => result.current.retry());
    await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
    expect(JSON.parse(request.mock.calls[3][1].body).entities).toHaveLength(2);
    act(() => result.current.reset());
    await waitFor(() => expect(result.current.highlight.size).toBe(0));
  });
  it('recovers a stale batch with its visible intersection and processes new response IDs separately', async () => {
    const { wrapper } = setup();
    const board = boardWith(2);
    const fresh = {
      ...board,
      cards: [board.cards[1], { ...board.cards[0], cardId: 'new-card' }],
    };
    request
      .mockRejectedValueOnce(
        new ApiError(404, 'views.entity_not_found', 'Unavailable', undefined),
      )
      .mockResolvedValueOnce(fresh)
      .mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ snapshot }) =>
        useBoardViews(
          'c',
          snapshot,
          new Set(boardEntities(snapshot).map((entity) => entity.entityId)),
        ),
      { wrapper, initialProps: { snapshot: board } },
    );
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(JSON.parse(request.mock.calls[2][1].body).entities).toEqual([
      { entityType: 'BOARD_CARD', entityId: 'card-1' },
    ]);
    rerender({ snapshot: fresh });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
    expect(JSON.parse(request.mock.calls[3][1].body).entities).toEqual([
      { entityType: 'BOARD_CARD', entityId: 'new-card' },
    ]);
    expect(result.current.highlight.has('card-0')).toBe(false);
    expect(result.current.highlight.has('new-card')).toBe(true);
  });
  it('stops after a second 404 and reports lost membership as unavailable', async () => {
    const { wrapper } = setup();
    const board = boardWith(1);
    request.mockImplementation(() => {
      return Promise.reject(
        new ApiError(404, 'campaign.not_found', 'Unavailable', undefined),
      );
    });
    const { result } = renderHook(
      () => useBoardViews('c', board, new Set(['card-0'])),
      { wrapper },
    );
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
  });
});
