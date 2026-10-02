import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Board, Campaign, Character } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { PageHeader } from '../../components/page-header';
import { Avatar } from '../../components/avatar';
import { PageError } from '../../components/page-error';
import { Skeleton } from '../../components/ui/skeleton';
import { characterSheet } from '../characters/tales-from-the-loop';
import {
  TalesFromTheLoopCreate,
  TalesFromTheLoopDetail,
  useCharacterMeta,
  apiErrorMessage,
} from '../characters/tales-from-the-loop-sheet';
import './materials.css';
import './characters-redesign.css';

function canEdit(
  character: Character,
  profileId: string | undefined,
  role: Campaign['currentUserRole'],
) {
  return role === 'PLAYER' && character.ownerId === profileId;
}

export function CharactersPage() {
  const { campaignId, characterId } = useParams();
  const navigate = useNavigate();
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const meta = useCharacterMeta();

  const [error, setError] = useState<string>();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () =>
      api.request<Character[]>(`/campaigns/${campaignId}/characters`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const sheet = characterSheet(campaign.data?.system);
  const board = useQuery({
    queryKey: ['board', campaignId],
    queryFn: () =>
      api.request<Board>(`/campaigns/${campaignId}/investigation-board`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const onBoard = useMemo(
    () =>
      new Set(
        (board.data?.cards ?? []).flatMap((card) =>
          card.reference?.characterId ? [card.reference.characterId] : [],
        ),
      ),
    [board.data],
  );
  const addToBoard = useMutation({
    mutationFn: (characterId: string) =>
      api.request(`/campaigns/${campaignId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cardKind: 'CHARACTER_REFERENCE', characterId }),
      }),
    onSuccess: () => {
      setError(undefined);
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const remove = useMutation({
    mutationFn: (characterId: string) =>
      api.request<void>(`/characters/${characterId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['characters', campaignId],
      });
      setError(undefined);
      void navigate(`/campaigns/${campaignId}/characters`, { replace: true });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  if (campaign.isError || characters.isError) {
    return (
      <PageError
        inline
        error={campaign.error ?? characters.error ?? undefined}
        onRetry={() => {
          void campaign.refetch();
          void characters.refetch();
        }}
      />
    );
  }

  const data = campaign.data;
  const role = data?.currentUserRole ?? 'VIEWER';
  const loading = characters.isLoading || campaign.isLoading;
  const list = characters.data ?? [];
  const canAddToBoard = role === 'OWNER' || role === 'PLAYER';
  const hasActivePlayerCharacter = list.some(
    (character) => character.isActive && character.ownerId === profile?.userId,
  );
  // A player without a character starts by creating one.
  const creating =
    !characterId &&
    role === 'PLAYER' &&
    !loading &&
    !hasActivePlayerCharacter &&
    Boolean(sheet);
  const selected = list.find(
    (character) => character.characterId === characterId,
  );

  const layoutClass = [
    'materials-layout',
    'characters-layout',
    characterId && 'materials-layout-detail',
    creating && 'characters-layout-create',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <PageHeader title={t('characters.title')} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className={layoutClass}>
        <section
          aria-label={t('characters.listLabel')}
          className="materials-list-pane"
        >
          <nav aria-busy={loading} className="materials-list">
            {loading ? (
              <div className="materials-skeleton">
                <span className="visually-hidden">{t('common.loading')}</span>
                {[0, 1, 2].map((row) => (
                  <Skeleton height="3.5rem" key={row} />
                ))}
              </div>
            ) : list.length > 0 ? (
              <ul className="character-list">
                {list.map((character) => (
                  <li key={character.characterId}>
                    <Link
                      aria-current={
                        character.characterId === characterId
                          ? 'page'
                          : undefined
                      }
                      className="materials-row character-row"
                      to={`/campaigns/${campaignId}/characters/${character.characterId}`}
                    >
                      <Avatar
                        alt={character.name}
                        imageUrl={character.avatarUrl}
                        seed={character.characterId}
                      />
                      <span className="character-row-text">
                        <span className="character-row-name">
                          {character.name}
                        </span>
                        {meta(character) && (
                          <span className="character-row-meta">
                            {meta(character)}
                          </span>
                        )}
                      </span>
                      {character.ownerId === profile?.userId && (
                        <span className="character-row-you">
                          {t('characters.you')}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              !creating && (
                <p className="materials-list-note">{t('characters.empty')}</p>
              )
            )}
          </nav>
        </section>
        <div className="materials-detail-pane">
          {characterId && !loading && !selected ? (
            <PageError inline />
          ) : !loading && !sheet ? (
            <p className="materials-select" role="alert">
              {t('characters.sheetUnavailable')}
            </p>
          ) : selected && sheet ? (
            <TalesFromTheLoopDetail
              key={selected.characterId}
              character={selected}
              editable={canEdit(selected, profile?.userId, role)}
              onBoard={onBoard.has(selected.characterId)}
              canAddToBoard={canAddToBoard}
              onAddToBoard={() => addToBoard.mutate(selected.characterId)}
              onDelete={() => {
                if (
                  window.confirm(
                    t('characters.deleteConfirmation', { name: selected.name }),
                  )
                )
                  remove.mutate(selected.characterId);
              }}
            />
          ) : creating && sheet ? (
            <TalesFromTheLoopCreate />
          ) : (
            list.length > 0 && (
              <p className="materials-select">{t('characters.select')}</p>
            )
          )}
        </div>
      </div>
    </>
  );
}
