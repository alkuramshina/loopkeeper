import { describe, expect, it } from 'vitest';
import { CampaignElement } from '../../api/client';
import {
  applyMarkdown,
  caseEntries,
  ownNotes,
  plainExcerpt,
  splitQuickNote,
} from './player-model';

const element = (
  id: string,
  updatedAt: string,
  extra: Partial<CampaignElement> = {},
): CampaignElement => ({
  elementId: id,
  campaignId: 'c',
  type: 'LOCATION',
  access: 'SHARED',
  title: id,
  content: null,
  imageUrl: null,
  typeData: {},
  createdAt: updatedAt,
  updatedAt,
  createdById: 'master',
  createdBy: { userId: 'master', name: 'Master' },
  ...extra,
});

describe('caseEntries', () => {
  it('puts newly shared materials first and groups the rest by day', () => {
    const entries = caseEntries(
      [
        element('old', new Date(2026, 8, 6, 12).toISOString()),
        element('latest', new Date(2026, 8, 20, 19, 52).toISOString(), {
          sharedAt: new Date(2026, 8, 20, 19, 52).toISOString(),
        }),
        element('same-day', new Date(2026, 8, 20, 19, 40).toISOString(), {
          sharedAt: new Date(2026, 8, 20, 19, 40).toISOString(),
        }),
        element('middle-a', new Date(2026, 8, 14, 18).toISOString()),
        element('middle-b', new Date(2026, 8, 14, 10).toISOString()),
      ],
      'player',
      new Date(2026, 8, 19).toISOString(),
    );
    expect(entries.recent.map((item) => item.elementId)).toEqual([
      'latest',
      'same-day',
    ]);
    expect(
      entries.earlier.map((day) => day.items.map((item) => item.elementId)),
    ).toEqual([['middle-a', 'middle-b'], ['old']]);
  });

  it('leaves out hidden materials and the reader’s own notes', () => {
    const at = new Date(2026, 8, 20).toISOString();
    const entries = caseEntries(
      [
        element('shared', at),
        element('hidden', at, { access: 'MASTER_ONLY' }),
        element('mine', at, { type: 'NOTE', createdById: 'player' }),
      ],
      'player',
    );
    expect(entries.all.map((item) => item.elementId)).toEqual(['shared']);
  });

  it('does not mark old materials as new on the first visit', () => {
    const items = [0, 1, 2, 3, 4, 5].map((minute) =>
      element(`m${minute}`, new Date(2026, 8, 20, 12, minute).toISOString()),
    );
    const entries = caseEntries(items, 'player');
    expect(entries.recent).toHaveLength(0);
    expect(entries.earlier[0].items).toHaveLength(6);
  });
});

describe('ownNotes', () => {
  it('keeps the reader’s notes, the last edited first', () => {
    const notes = ownNotes(
      [
        element('a', '2026-09-01T10:00:00.000Z', {
          type: 'NOTE',
          createdById: 'player',
        }),
        element('b', '2026-09-02T10:00:00.000Z', {
          type: 'NOTE',
          createdById: 'player',
        }),
        element('other', '2026-09-03T10:00:00.000Z', { type: 'NOTE' }),
      ],
      'player',
    );
    expect(notes.map((note) => note.elementId)).toEqual(['b', 'a']);
  });
});

describe('splitQuickNote', () => {
  it('turns the first line into the title and the rest into the text', () => {
    expect(splitQuickNote('  Кто взял ключ?\nСпросить у Рикарды\n')).toEqual({
      title: 'Кто взял ключ?',
      content: 'Спросить у Рикарды',
    });
  });

  it('shortens a long first line at a word and keeps the whole text', () => {
    const text = `${'слово '.repeat(20)}конец`;
    const { title, content } = splitQuickNote(text);
    expect(title.endsWith('слово…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(81);
    expect(content).toBe(text);
  });
});

describe('plainExcerpt', () => {
  it('drops Markdown marks and joins lines', () => {
    expect(
      plainExcerpt('## Будка\n- **Замок** снаружи\n[карта](https://x.test)'),
    ).toBe('Будка Замок снаружи карта');
  });
});

describe('applyMarkdown', () => {
  it('wraps a selection in bold and unwraps it again', () => {
    const bold = applyMarkdown('ключ от будки', 0, 4, 'bold');
    expect(bold).toEqual({ text: '**ключ** от будки', start: 2, end: 6 });
    expect(applyMarkdown(bold.text, bold.start, bold.end, 'bold').text).toBe(
      'ключ от будки',
    );
  });

  it('turns every selected line into a list item and back', () => {
    const text = 'первое\nвторое\nтретье';
    const list = applyMarkdown(text, 2, 9, 'list');
    expect(list.text).toBe('- первое\n- второе\nтретье');
    expect(applyMarkdown(list.text, list.start, list.end, 'list').text).toBe(
      text,
    );
  });

  it('makes the current line a heading', () => {
    expect(applyMarkdown('текст\nзаголовок', 8, 8, 'heading').text).toBe(
      'текст\n## заголовок',
    );
  });
});
