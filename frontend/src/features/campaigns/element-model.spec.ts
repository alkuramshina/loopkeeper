import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { Board } from '../../api/client';
import { boardFootprint, formatChanged } from './element-model';

describe('formatChanged', () => {
  const now = new Date(2026, 8, 27, 20, 0);
  const t = i18n.t.bind(i18n);

  it('speaks of today and yesterday, then of the date', () => {
    expect(
      formatChanged(new Date(2026, 8, 27, 18, 20).toISOString(), t, now),
    ).toBe('сегодня, 18:20');
    expect(
      formatChanged(new Date(2026, 8, 26, 9, 5).toISOString(), t, now),
    ).toBe('вчера, 09:05');
    expect(
      formatChanged(new Date(2026, 8, 12, 18, 20).toISOString(), t, now),
    ).toBe('12 сентября, 18:20');
    expect(
      formatChanged(new Date(2025, 0, 3, 7, 0).toISOString(), t, now),
    ).toBe('3 января 2025 г., 07:00');
  });
});

describe('boardFootprint', () => {
  it('counts the cards of a material and every link that touches them', () => {
    const board = {
      boardId: 'b',
      cards: [
        { cardId: 'a', reference: { kind: 'ELEMENT', elementId: 'x' } },
        { cardId: 'b', reference: { kind: 'ELEMENT', elementId: 'x' } },
        { cardId: 'c' },
      ],
      links: [
        { linkId: '1', fromCardId: 'a', toCardId: 'b' },
        { linkId: '2', fromCardId: 'c', toCardId: 'b' },
        { linkId: '3', fromCardId: 'c', toCardId: 'c' },
      ],
    } as unknown as Board;
    expect(boardFootprint(board, 'x')).toEqual({ cards: 2, links: 2 });
    expect(boardFootprint(board, 'y')).toEqual({ cards: 0, links: 0 });
  });
});
