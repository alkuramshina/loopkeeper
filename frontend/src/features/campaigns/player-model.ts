import { Board, CampaignElement } from '../../api/client';

const dayKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * The case: what is open to the group, newest first, without the notes of
 * `authorId` (a player keeps those in "My notes"). The
 * new materials since the last visit come first; the rest follows by day.
 */
export function caseEntries(
  elements: CampaignElement[],
  authorId: string | undefined,
  newSinceAt?: string | null,
) {
  const shared = elements
    .filter((item) => item.access === 'SHARED' && item.createdById !== authorId)
    .sort((a, b) =>
      (b.sharedAt ?? b.updatedAt).localeCompare(a.sharedAt ?? a.updatedAt),
    );
  const recent = newSinceAt
    ? shared.filter((item) => item.sharedAt && item.sharedAt > newSinceAt)
    : [];
  const recentIds = new Set(recent.map((item) => item.elementId));
  const earlier: { day: string; items: CampaignElement[] }[] = [];
  for (const item of shared.filter(
    (candidate) => !recentIds.has(candidate.elementId),
  )) {
    const day = dayKey(item.sharedAt ?? item.updatedAt);
    const last = earlier[earlier.length - 1];
    if (last && last.day === day) last.items.push(item);
    else earlier.push({ day, items: [item] });
  }
  return { all: shared, recent, earlier };
}

/** The player's own notes, the last edited first. */
export function ownNotes(
  elements: CampaignElement[],
  userId: string | undefined,
) {
  return elements
    .filter((item) => item.type === 'NOTE' && item.createdById === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Materials that have at least one card on the board. */
export function elementsOnBoard(board: Board | undefined) {
  return new Set(
    (board?.cards ?? []).flatMap((card) =>
      card.reference?.elementId ? [card.reference.elementId] : [],
    ),
  );
}

export const titleLimit = 200;
const quickTitleLength = 80;

/**
 * A quick note is one field: its first line becomes the title. A first line
 * too long for a title is shortened, and then the whole text stays the body
 * so nothing is lost.
 */
export function splitQuickNote(text: string) {
  const trimmed = text.trim();
  const [first, ...rest] = trimmed.split('\n');
  const line = first.trim();
  if (line.length <= quickTitleLength)
    return { title: line, content: rest.join('\n').trim() };
  const cut = line.slice(0, quickTitleLength);
  const atWord = cut.slice(0, cut.lastIndexOf(' ')).trim() || cut;
  return { title: `${atWord}…`, content: trimmed };
}

/** Markdown reduced to plain words for a one- or two-line excerpt. */
export function plainExcerpt(markdown: string | null | undefined) {
  return (markdown ?? '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MarkdownAction = 'bold' | 'italic' | 'list' | 'heading';

/**
 * Applies a formatting button to a text selection: bold and italic wrap the
 * selection (or unwrap it), list and heading prefix every selected line.
 * Returns the new text and the selection to restore.
 */
export function applyMarkdown(
  text: string,
  start: number,
  end: number,
  action: MarkdownAction,
) {
  if (action === 'bold' || action === 'italic') {
    const mark = action === 'bold' ? '**' : '*';
    const before = text.slice(0, start);
    const after = text.slice(end);
    const selected = text.slice(start, end);
    if (before.endsWith(mark) && after.startsWith(mark))
      return {
        text:
          before.slice(0, -mark.length) + selected + after.slice(mark.length),
        start: start - mark.length,
        end: end - mark.length,
      };
    return {
      text: before + mark + selected + mark + after,
      start: start + mark.length,
      end: end + mark.length,
    };
  }
  const prefix = action === 'list' ? '- ' : '## ';
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', Math.max(end - 1, start));
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const remove = lines.every((line) => line.startsWith(prefix));
  const changed = lines
    .map((line) => (remove ? line.slice(prefix.length) : prefix + line))
    .join('\n');
  const shift = remove ? -prefix.length : prefix.length;
  return {
    text: text.slice(0, lineStart) + changed + text.slice(lineEnd),
    start: Math.max(lineStart, start + shift),
    end: end + shift * lines.length,
  };
}
