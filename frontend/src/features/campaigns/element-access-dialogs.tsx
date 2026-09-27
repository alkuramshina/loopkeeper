import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Undo2 } from 'lucide-react';
import { Board, CampaignElement, CampaignMember } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { Avatar } from '../../components/avatar';
import { ModalDialog } from '../../components/modal-dialog';
import { ProtectedImage } from '../../components/protected-image';
import { SafeMarkdown } from '../../components/safe-markdown';
import { Button } from '../../components/ui/button';
import { iconProps } from '../../components/ui/icon';
import { Skeleton } from '../../components/ui/skeleton';
import { TypeTag } from '../../components/ui/type-tag';
import { boardFootprint, isMapUrl, npcFields, npcText } from './element-model';

type AccessDialogProps = {
  element: CampaignElement;
  /** The master speaks of players; a player author of the other members. */
  owner: boolean;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** Everything the players will receive, exactly as they will read it. */
function PlayerPreview({ element }: { element: CampaignElement }) {
  const { t } = useTranslation();
  return (
    <div className="reveal-preview">
      <TypeTag type={element.type} />
      <h3>{element.title}</h3>
      {element.coverUrl && (
        <ProtectedImage
          alt=""
          className="reveal-preview-image"
          imageUrl={element.coverUrl}
        />
      )}
      {element.content && (
        <div className="markdown-body">
          <SafeMarkdown content={element.content} />
        </div>
      )}
      {element.type === 'NPC' && (
        <dl className="material-facts">
          {npcFields.map((field) =>
            npcText(element.typeData?.[field]) ? (
              <div key={field}>
                <dt>{t(`elements.npc.${field}`)}</dt>
                <dd>{npcText(element.typeData[field])}</dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
      {element.type === 'LOCATION' && isMapUrl(element.imageUrl) && (
        <figure className="reveal-preview-map">
          <ProtectedImage
            alt=""
            className="reveal-preview-image"
            imageUrl={element.imageUrl}
          />
          <figcaption>{t('elements.reveal.map')}</figcaption>
        </figure>
      )}
    </div>
  );
}

function Audience() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () =>
      api.request<CampaignMember[]>(`/campaigns/${campaignId}/members`),
    retry: false,
  });
  if (members.isLoading)
    return (
      <div className="reveal-audience" aria-busy="true">
        <Skeleton width="10rem" />
        <Skeleton height="2rem" />
      </div>
    );
  const audience = (members.data ?? []).filter(
    (member) => member.campaignRole !== 'OWNER',
  );
  if (members.isError)
    return <p className="reveal-audience">{t('elements.reveal.everyone')}</p>;
  if (!audience.length)
    return <p className="reveal-audience">{t('elements.reveal.nobody')}</p>;
  const names = new Intl.ListFormat('ru', { type: 'conjunction' }).format(
    audience.map((member) => {
      const name =
        member.user.name || member.user.email || t('elements.unnamedAuthor');
      return member.campaignRole === 'VIEWER'
        ? t('elements.reveal.viewerName', { name })
        : name;
    }),
  );
  return (
    <div className="reveal-audience">
      <strong>
        {t('elements.reveal.audience', { count: audience.length })}
      </strong>
      <div className="reveal-audience-people">
        <span className="reveal-avatars" aria-hidden="true">
          {audience.slice(0, 5).map((member) => (
            <Avatar
              alt=""
              imageUrl={member.user.avatarUrl}
              key={member.memberId}
              seed={member.user.name || member.user.email}
              size="small"
            />
          ))}
        </span>
        <span>{names}</span>
      </div>
    </div>
  );
}

export function RevealDialog({
  element,
  owner,
  pending,
  error,
  onClose,
  onConfirm,
}: AccessDialogProps) {
  const { t } = useTranslation();
  const voice = owner ? 'master' : 'player';
  return (
    <ModalDialog
      description={t(`elements.reveal.${voice}.description`)}
      onClose={onClose}
      title={t(`elements.reveal.${voice}.title`, { title: element.title })}
      wide
    >
      <div className="access-dialog-body reveal-dialog-body">
        <section aria-label={t('elements.reveal.previewLabel')}>
          <p className="access-dialog-label">
            <Eye {...iconProps} />
            {t('elements.reveal.previewLabel')}
          </p>
          <PlayerPreview element={element} />
        </section>
        <div className="access-dialog-notes">
          {owner ? (
            <Audience />
          ) : (
            <p className="reveal-audience">
              <strong>{t('elements.reveal.allMembers')}</strong>
            </p>
          )}
          <p className="access-dialog-note access-dialog-note-dot">
            {t(`elements.reveal.${voice}.where`)}
          </p>
          <p className="access-dialog-note">
            <Undo2 {...iconProps} />
            {t('elements.reveal.undo')}
          </p>
        </div>
      </div>
      {error && (
        <p className="form-error access-dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="access-dialog-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          disabled={pending}
          icon={Eye}
          onClick={onConfirm}
          variant="primary"
        >
          {t(`elements.reveal.${voice}.confirm`)}
        </Button>
      </div>
    </ModalDialog>
  );
}

/** Hiding removes the material's cards and links from the board; say how many. */
export function HideDialog({
  element,
  owner,
  pending,
  error,
  onClose,
  onConfirm,
}: AccessDialogProps) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const voice = owner ? 'master' : 'player';
  const board = useQuery({
    queryKey: ['board', campaignId],
    queryFn: () =>
      api.request<Board>(`/campaigns/${campaignId}/investigation-board`),
    retry: false,
  });
  const footprint = board.data
    ? boardFootprint(board.data, element.elementId)
    : undefined;
  const clearsBoard = !footprint || footprint.cards > 0;
  return (
    <ModalDialog
      onClose={onClose}
      title={t(`elements.hide.${voice}.title`, { title: element.title })}
    >
      <div className="access-dialog-body" aria-busy={board.isLoading}>
        {board.isLoading ? (
          <Skeleton height="1.5rem" />
        ) : (
          <p className="access-dialog-consequence">
            {!footprint
              ? t('elements.hide.boardUnknown')
              : footprint.cards > 0
                ? t('elements.hide.boardCleared', {
                    cards: t('elements.hide.cards', { count: footprint.cards }),
                    links: t('elements.hide.links', { count: footprint.links }),
                  })
                : t('elements.hide.notOnBoard')}
          </p>
        )}
        <p className="access-dialog-note">
          {t(`elements.hide.${voice}.after`)}
        </p>
      </div>
      {error && (
        <p className="form-error access-dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="access-dialog-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          disabled={pending || board.isLoading}
          icon={EyeOff}
          onClick={onConfirm}
          variant={clearsBoard ? 'danger' : 'primary'}
        >
          {t(`elements.hide.${voice}.confirm`)}
        </Button>
      </div>
    </ModalDialog>
  );
}
