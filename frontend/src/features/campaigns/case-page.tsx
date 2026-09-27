import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, PencilLine, UserRound } from 'lucide-react';
import {
  ApiError,
  Board,
  Campaign,
  CampaignElement,
  CampaignElementType,
  Character,
  CharacterTemplate,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { Avatar } from '../../components/avatar';
import { ModalDialog } from '../../components/modal-dialog';
import { PageError } from '../../components/page-error';
import { ProtectedImage } from '../../components/protected-image';
import { Button } from '../../components/ui/button';
import { Chip } from '../../components/ui/chip';
import { EmptyState } from '../../components/ui/empty-state';
import { iconProps } from '../../components/ui/icon';
import { NewMark } from '../../components/ui/new-mark';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { Skeleton } from '../../components/ui/skeleton';
import { useToast } from '../../components/ui/toast';
import { TypeTag, typeIcons } from '../../components/ui/type-tag';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { ElementDetail } from './element-detail';
import { elementTypes, formatChanged } from './element-model';
import { caseEntries, elementsOnBoard, plainExcerpt } from './player-model';
import { QuickNoteDraft, QuickNoteForm, emptyQuickNote } from './quick-note';
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

/** The phone's quick note: a button that opens the form in a bottom sheet. */
function QuickNoteSheet({
  draft,
  onDraft,
  onClose,
}: {
  draft: QuickNoteDraft;
  onDraft: (draft: QuickNoteDraft) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <ModalDialog onClose={onClose} sheet title={t('case.quickNote.title')}>
      <div className="quick-note-sheet">
        <QuickNoteForm
          autoFocus
          draft={draft}
          onDraft={onDraft}
          onSaved={() => {
            onClose();
            toast.show({ message: t('case.quickNote.savedToast') });
          }}
        />
      </div>
    </ModalDialog>
  );
}

/** The player's active character with the conditions switched on. */
function MyCharacter({ campaign }: { campaign: Campaign }) {
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const base = `/campaigns/${campaign.campaignId}`;
  const characters = useQuery({
    queryKey: ['characters', campaign.campaignId],
    queryFn: () => api.request<Character[]>(`${base}/characters`),
    retry: false,
  });
  const templates = useQuery({
    queryKey: ['character-templates', campaign.system],
    queryFn: () =>
      api.request<CharacterTemplate[]>(
        `/game-systems/${campaign.system}/templates`,
      ),
    enabled: Boolean(campaign.system),
    retry: false,
  });
  const character = characters.data?.find(
    (item) => item.isActive && item.ownerId === profile?.userId,
  );
  // Conditions come from the system's template, not from this component.
  const conditions = (
    templates.data?.find((item) => item.templateId === character?.templateId)
      ?.schema.fields ?? []
  ).filter(
    (field) =>
      field.section === 'conditions' &&
      field.type === 'boolean' &&
      character?.data[field.key] === true,
  );

  return (
    <section aria-labelledby="case-character" className="case-character">
      <h2 className="case-side-title" id="case-character">
        {t('case.character.title')}
      </h2>
      {characters.isLoading ? (
        <Skeleton height="4.5rem" />
      ) : character ? (
        <>
          <Link className="case-character-card" to={`${base}/characters`}>
            <Avatar
              alt=""
              imageUrl={character.avatarUrl}
              seed={character.name}
            />
            <span>
              <strong>{character.name}</strong>
              {character.description && (
                <span className="case-character-description">
                  {character.description}
                </span>
              )}
            </span>
          </Link>
          {conditions.length > 0 && (
            <ul
              aria-label={t('case.character.conditions')}
              className="case-conditions"
            >
              {conditions.map((field) => (
                <li key={field.key}>
                  <Chip>
                    {t(`case.character.condition.${field.key}`, {
                      defaultValue: field.label,
                    })}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="case-side-note">
          <UserRound {...iconProps} />
          <span>
            {t('case.character.none')}{' '}
            <Link to={`${base}/characters`}>{t('case.character.create')}</Link>
          </span>
        </p>
      )}
    </section>
  );
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
  quickNote,
}: {
  campaign: Campaign;
  elements: CampaignElement[];
  loading: boolean;
  quickNote?: {
    draft: QuickNoteDraft;
    onDraft: (draft: QuickNoteDraft) => void;
    onOpenSheet: () => void;
  };
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
        campaign.newSinceAt,
      ),
    [campaign.newSinceAt, elements, filter, notesElsewhere],
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
    <div className={player ? 'case-layout' : 'case-layout case-layout-single'}>
      <section aria-labelledby="case-title" className="case-main">
        <header className="case-head">
          <div>
            <h1 id="case-title">{t('elements.caseTitle')}</h1>
            <p className="case-lead">{t('case.lead')}</p>
          </div>
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
        </header>
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
                  <NewMark>
                    {t('case.recent', {
                      date: dayFormat.format(new Date(campaign.newSinceAt!)),
                    })}
                  </NewMark>
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
              <section aria-labelledby="case-earlier" className="case-section">
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
      {quickNote && (
        <>
          <div className="case-quick-note">
            <QuickNoteForm
              draft={quickNote.draft}
              onDraft={quickNote.onDraft}
            />
          </div>
          <MyCharacter campaign={campaign} />
          <Button
            aria-label={t('case.quickNote.title')}
            className="case-quick-note-fab"
            icon={PencilLine}
            onClick={quickNote.onOpenSheet}
            size="lg"
            variant="primary"
          />
        </>
      )}
    </div>
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
      <PageError error={detail.error} onRetry={() => void detail.refetch()} />
    );
  if (detail.isLoading)
    return (
      <div aria-busy="true" className="material-document case-reader-loading">
        <Skeleton width="8rem" height="1.625rem" radius="pill" />
        <Skeleton width="60%" height="2.5rem" />
        <Skeleton height="6rem" />
      </div>
    );
  if (element && contributor && element.createdById === profile?.userId)
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
  const { campaign, elements } = useCampaignData();
  const [draft, setDraft] = useState<QuickNoteDraft>(emptyQuickNote);
  const [sheet, setSheet] = useState(false);

  if (campaign.isError || elements.isError)
    return (
      <PageError
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
  const player = campaign.data?.currentUserRole === 'PLAYER';

  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      {campaign.data &&
        (elementId ? (
          <CaseReader
            campaign={campaign.data}
            elementId={elementId}
            onQuickNote={player ? () => setSheet(true) : undefined}
          />
        ) : (
          <CaseOverview
            campaign={campaign.data}
            elements={elements.data ?? []}
            loading={elements.isLoading}
            quickNote={
              player
                ? {
                    draft,
                    onDraft: setDraft,
                    onOpenSheet: () => setSheet(true),
                  }
                : undefined
            }
          />
        ))}
      {sheet && (
        <QuickNoteSheet
          draft={draft}
          onClose={() => setSheet(false)}
          onDraft={setDraft}
        />
      )}
    </CampaignWorkspaceShell>
  );
}
