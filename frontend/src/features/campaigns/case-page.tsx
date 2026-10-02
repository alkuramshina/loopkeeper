import { useQuickNote } from './quick-note-context';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, PencilLine } from 'lucide-react';
import {
  ApiError,
  Board,
  Campaign,
  CampaignElement,
  CampaignElementType,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';

import { PageError } from '../../components/page-error';
import { PageHeader } from '../../components/page-header';
import { ProtectedImage } from '../../components/protected-image';
import { Button } from '../../components/ui/button';

import { EmptyState } from '../../components/ui/empty-state';
import { iconProps } from '../../components/ui/icon';
import { NewMark } from '../../components/ui/new-mark';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { Skeleton } from '../../components/ui/skeleton';

import { TypeTag, typeIcons } from '../../components/ui/type-tag';
import { ElementDetail } from './element-detail';
import { elementTypes, formatChanged } from './element-model';
import { caseEntries, elementsOnBoard, plainExcerpt } from './player-model';

import { useAddToBoard } from './use-element-actions';
import './materials.css';
import './player.css';

type TypeFilter = 'all' | CampaignElementType;

const dayFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
});
const shortDayFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
});

function useCampaignData() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const elements = useQuery({
    queryKey: ['elements', campaignId],
    queryFn: () =>
      api.request<CampaignElement[]>(`/campaigns/${campaignId}/elements`),
    enabled: Boolean(campaign.data),
    retry: false,
  });
  return { campaign, elements };
}

function RecentCard({
  element,
  onBoard,
  to,
}: {
  element: CampaignElement;
  onBoard: boolean;
  to: string;
}) {
  const { t } = useTranslation();
  const excerpt = plainExcerpt(element.content);
  return (
    <Link className="case-card" to={to}>
      {element.coverUrl && (
        <ProtectedImage
          alt=""
          className="case-card-cover"
          imageUrl={element.coverUrl}
        />
      )}
      <span className="case-card-body">
        <span className="case-card-meta">
          <TypeTag type={element.type} />
          <NewMark>
            {t('case.opened', {
              when: formatChanged(element.sharedAt ?? element.updatedAt, t),
            })}
          </NewMark>
        </span>
        <strong className="case-card-title">{element.title}</strong>
        {excerpt && <span className="case-card-excerpt">{excerpt}</span>}
        {onBoard && (
          <span className="case-card-board">
            <LayoutDashboard {...iconProps} />
            {t('case.onBoard')}
          </span>
        )}
      </span>
    </Link>
  );
}

function CaseOverview({
  campaign,
  elements,
  loading,
}: {
  campaign: Campaign;
  elements: CampaignElement[];
  loading: boolean;
}) {
  const { campaignId } = useParams();
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TypeFilter>('all');
  const board = useQuery({
    queryKey: ['board', campaignId],
    queryFn: () =>
      api.request<Board>(`/campaigns/${campaignId}/investigation-board`),
    retry: false,
  });
  const onBoard = useMemo(() => elementsOnBoard(board.data), [board.data]);
  const player = campaign.currentUserRole === 'PLAYER';
  // A player's own notes live in "My notes"; a viewer has no notes screen,
  // so their earlier shared notes stay in the case.
  const notesElsewhere = player ? profile?.userId : undefined;
  const entries = useMemo(
    () =>
      caseEntries(
        elements.filter((item) => filter === 'all' || item.type === filter),
        notesElsewhere,
      ),
    [elements, filter, notesElsewhere],
  );
  const total = caseEntries(elements, notesElsewhere).all.length;
  const path = (item: CampaignElement) =>
    `/campaigns/${campaignId}/case/${item.elementId}`;
  const rowMeta = (item: CampaignElement) =>
    [
      t(`elements.types.${item.type}`),
      onBoard.has(item.elementId) && t('case.onBoardShort'),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <>
      <PageHeader
        title={t('elements.caseTitle')}
        titleId="case-title"
        lead={t('case.lead')}
      />
      <div className="case-layout case-layout-single">
        <section aria-labelledby="case-title" className="case-main">
          {total > 0 && (
            <div className="case-filter">
              <SegmentedControl
                label={t('case.filter')}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('case.filterAll') },
                  ...elementTypes.map((type) => ({
                    value: type,
                    label: t(`elements.groups.${type}`),
                  })),
                ]}
                value={filter}
              />
            </div>
          )}
          {loading ? (
            <div aria-busy="true" className="case-recent-grid">
              <span className="visually-hidden">{t('common.loading')}</span>
              <Skeleton height="12rem" />
              <Skeleton height="12rem" />
            </div>
          ) : total === 0 ? (
            <EmptyState title={t('case.empty')}>
              <p>{t('case.emptyText')}</p>
            </EmptyState>
          ) : entries.all.length === 0 ? (
            <p className="case-note">{t('case.nothingOfType')}</p>
          ) : (
            <>
              {entries.recent.length > 0 && (
                <section aria-labelledby="case-recent" className="case-section">
                  <h2 className="case-section-title" id="case-recent">
                    <NewMark>{t('case.recent')}</NewMark>
                  </h2>
                  <ul className="case-recent-grid">
                    {entries.recent.map((item) => (
                      <li key={item.elementId}>
                        <RecentCard
                          element={item}
                          onBoard={onBoard.has(item.elementId)}
                          to={path(item)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {entries.earlier.length > 0 && (
                <section
                  aria-labelledby="case-earlier"
                  className="case-section"
                >
                  <h2 className="case-section-title" id="case-earlier">
                    {t('case.earlier')}
                  </h2>
                  <div className="case-earlier">
                    {entries.earlier.map((group) => {
                      const date = new Date(
                        group.items[0].sharedAt ?? group.items[0].updatedAt,
                      );
                      return (
                        <section
                          aria-label={dayFormat.format(date)}
                          className="case-day"
                          key={group.day}
                        >
                          <p aria-hidden="true" className="case-day-date">
                            {dayFormat.format(date)}
                          </p>
                          <ul>
                            {group.items.map((item) => {
                              const Icon = typeIcons[item.type];
                              return (
                                <li key={item.elementId}>
                                  <Link className="case-row" to={path(item)}>
                                    <Icon
                                      {...iconProps}
                                      className="case-row-icon"
                                    />
                                    <span className="case-row-title">
                                      {item.title}
                                    </span>
                                    <span className="case-row-meta">
                                      {rowMeta(item)}
                                    </span>
                                    <span className="case-row-date">
                                      {shortDayFormat.format(date)}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function CaseReader({
  campaign,
  elementId,
  onQuickNote,
}: {
  campaign: Campaign;
  elementId: string;
  onQuickNote?: () => void;
}) {
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const casePath = `/campaigns/${campaign.campaignId}/case`;
  const detail = useQuery({
    queryKey: ['element', elementId],
    queryFn: () => api.request<CampaignElement>(`/elements/${elementId}`),
    retry: false,
  });
  const addToBoard = useAddToBoard(elementId);
  const contributor = campaign.currentUserRole === 'PLAYER';
  const element =
    detail.data?.campaignId === campaign.campaignId ? detail.data : undefined;

  if (detail.isError && !(detail.error instanceof ApiError))
    return (
      <PageError
        error={detail.error}
        inline
        onRetry={() => void detail.refetch()}
      />
    );
  if (detail.isLoading)
    return (
      <div aria-busy="true" className="material-document case-reader-loading">
        <Skeleton width="8rem" height="1.625rem" radius="pill" />
        <Skeleton width="60%" height="2.5rem" />
        <Skeleton height="6rem" />
      </div>
    );
  if (
    element &&
    element.type === 'NOTE' &&
    contributor &&
    element.createdById === profile?.userId
  )
    return (
      <Navigate
        replace
        to={`/campaigns/${campaign.campaignId}/notes/${element.elementId}`}
      />
    );
  if (!element)
    return (
      <EmptyState title={t('elements.unavailable')}>
        <p>{t('elements.unavailableText')}</p>
        <Link to={casePath}>{t('elements.backToCase')}</Link>
      </EmptyState>
    );
  return (
    <div className="case-reader">
      <ElementDetail
        backTo={casePath}
        element={element}
        key={element.elementId}
        onDelete={() => undefined}
        readerActions={
          contributor && (
            <>
              <Button
                disabled={addToBoard.isPending}
                icon={LayoutDashboard}
                onClick={() => addToBoard.mutate()}
                size="lg"
              >
                {t('elements.addToBoard')}
              </Button>
              {onQuickNote && (
                <Button
                  icon={PencilLine}
                  onClick={onQuickNote}
                  size="lg"
                  variant="primary"
                >
                  {t('case.writeNote')}
                </Button>
              )}
            </>
          )
        }
        startEditing={false}
        viewer={{ owner: false, contributor, isAuthor: false }}
      />
    </div>
  );
}

export function CasePage() {
  const { campaignId, elementId } = useParams();
  const quickNote = useQuickNote();
  const { campaign, elements } = useCampaignData();

  if (campaign.isError || elements.isError)
    return (
      <PageError
        inline
        error={campaign.error ?? elements.error ?? undefined}
        onRetry={() => {
          void campaign.refetch();
          void elements.refetch();
        }}
      />
    );
  // The master keeps the materials list; the case is the players' view.
  if (campaign.data?.currentUserRole === 'OWNER')
    return (
      <Navigate
        replace
        to={`/campaigns/${campaignId}/elements${elementId ? `/${elementId}` : ''}`}
      />
    );

  return (
    <>
      {campaign.data &&
        (elementId ? (
          <CaseReader
            campaign={campaign.data}
            elementId={elementId}
            onQuickNote={quickNote?.profile ? quickNote.openNote : undefined}
          />
        ) : (
          <CaseOverview
            campaign={campaign.data}
            elements={elements.data ?? []}
            loading={elements.isLoading}
          />
        ))}
    </>
  );
}
