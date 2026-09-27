import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, PencilLine, Search } from 'lucide-react';
import { Board, Campaign, CampaignElement } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';
import './campaign-search.css';

type SearchResult = {
  id: string;
  title: string;
  detail: string;
  href: string;
  text: string;
  excerpt: string;
};

function Highlight({ text, term }: { text: string; term: string }) {
  const at = text.toLocaleLowerCase('ru').indexOf(term);
  if (!term || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

export function CampaignSearch({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}) {
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'hidden'>('all');
  const [active, setActive] = useState(0);
  const base = `/campaigns/${campaign.campaignId}`;
  const owner = campaign.currentUserRole === 'OWNER';
  const elements = useQuery({
    queryKey: ['elements', campaign.campaignId],
    queryFn: () => api.request<CampaignElement[]>(`${base}/elements`),
    retry: false,
  });
  const board = useQuery({
    queryKey: ['board', campaign.campaignId],
    queryFn: () => api.request<Board>(`${base}/investigation-board`),
    retry: false,
  });
  const normalized = term.trim().toLocaleLowerCase('ru');
  const results = useMemo(() => {
    const items: SearchResult[] = [];
    for (const element of elements.data ?? []) {
      if (owner && filter === 'open' && element.access !== 'SHARED') continue;
      if (owner && filter === 'hidden' && element.access === 'SHARED') continue;
      const ownNote =
        element.type === 'NOTE' && element.createdById === profile?.userId;
      const section = owner
        ? 'elements'
        : ownNote && campaign.currentUserRole === 'PLAYER'
          ? 'notes'
          : 'case';
      items.push({
        id: `element-${element.elementId}`,
        title: element.title,
        detail: t(`elements.types.${element.type}`),
        href: `${base}/${section}/${element.elementId}`,
        text: `${element.title} ${element.content ?? ''}`,
        excerpt: element.content ?? '',
      });
    }
    if (filter === 'all')
      for (const card of board.data?.cards ?? []) {
        items.push({
          id: `card-${card.cardId}`,
          title: card.title,
          detail: t('search.boardCard'),
          href: `${base}/board?card=${encodeURIComponent(card.cardId)}`,
          text: `${card.title} ${card.content ?? ''} ${card.tags.join(' ')}`,
          excerpt: `${card.content ?? ''} ${card.tags.join(' ')}`,
        });
      }
    return items
      .filter(
        (item) =>
          !normalized || item.text.toLocaleLowerCase('ru').includes(normalized),
      )
      .slice(0, 50);
  }, [
    elements.data,
    board.data,
    owner,
    filter,
    normalized,
    profile?.userId,
    campaign.currentUserRole,
    base,
    t,
  ]);
  useEffect(() => setActive(0), [term, filter]);
  const open = (href: string) => {
    onClose();
    void navigate(href);
  };
  const canWrite = campaign.currentUserRole === 'PLAYER';

  return (
    <ModalDialog title={t('search.title')} onClose={onClose} wide sheet>
      <div className="campaign-search">
        <label className="campaign-search-input">
          <Search aria-hidden="true" size={20} />
          <span className="visually-hidden">{t('search.placeholder')}</span>
          <input
            autoFocus
            type="search"
            value={term}
            placeholder={t('search.placeholder')}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, results.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              }
              if (event.key === 'Enter' && results[active]) {
                event.preventDefault();
                open(results[active].href);
              }
            }}
          />
        </label>
        {owner && (
          <div
            className="campaign-search-filters"
            aria-label={t('search.filter')}
          >
            {(['all', 'open', 'hidden'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {t(`search.filters.${value}`)}
              </button>
            ))}
          </div>
        )}
        <div className="campaign-search-results" aria-live="polite">
          {(elements.isPending || board.isPending) && (
            <p>{t('common.loading')}</p>
          )}
          {(elements.isError || board.isError) && (
            <p role="alert">{t('search.loadError')}</p>
          )}
          {!elements.isPending && !board.isPending && results.length === 0 && (
            <p>{t('search.empty')}</p>
          )}
          {results.map((item, index) => (
            <button
              className={index === active ? 'active' : ''}
              key={item.id}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => open(item.href)}
            >
              <span className="campaign-search-result-main">
                <span className="campaign-search-result-title">
                  <Highlight text={item.title} term={normalized} />
                </span>
                {item.excerpt && (
                  <span className="campaign-search-result-excerpt">
                    <Highlight
                      text={item.excerpt.slice(0, 100)}
                      term={normalized}
                    />
                  </span>
                )}
              </span>
              <span className="campaign-search-result-detail">
                {item.detail}
              </span>
            </button>
          ))}
        </div>
        {canWrite && (
          <button
            className="campaign-search-action"
            type="button"
            onClick={() => open(`${base}/case?quick-note=1`)}
          >
            <PencilLine size={17} aria-hidden="true" />
            {t('search.quickNote')}
          </button>
        )}
        <p className="campaign-search-hint">
          <LayoutDashboard size={14} aria-hidden="true" />
          {t('search.hint')}
        </p>
      </div>
    </ModalDialog>
  );
}
