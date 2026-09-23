import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import {
  ApiError,
  Campaign,
  Character,
  CharacterField,
  CharacterTemplate,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

type Filter = 'all' | 'players' | 'npcs';

type EditorTarget = {
  character?: Character;
  isNPC: boolean;
};

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function canEdit(
  character: Character,
  profileId: string | undefined,
  role: Campaign['currentUserRole'],
) {
  return character.isNPC ? role === 'OWNER' : character.ownerId === profileId;
}

function readFieldValue(field: CharacterField, form: FormData): unknown {
  if (field.type === 'boolean') return form.get(field.key) === 'on';

  const value = String(form.get(field.key) ?? '').trim();
  if (!value && !field.required) return undefined;
  return field.type === 'number' ? Number(value) : value;
}

function CharacterEditor({
  target,
  templates,
  onClose,
}: {
  target: EditorTarget;
  templates: CharacterTemplate[];
  onClose: () => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const availableTemplates = templates.filter(
    (item) =>
      item.characterKind === (target.isNPC ? 'NPC' : 'PLAYER_CHARACTER'),
  );
  const [templateId, setTemplateId] = useState(
    target.character?.templateId ?? availableTemplates[0]?.templateId ?? '',
  );
  const [error, setError] = useState<string>();
  const template = availableTemplates.find(
    (item) => item.templateId === templateId,
  );

  const save = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!campaignId || !template) return;

      const form = new FormData(event.currentTarget);
      const data = Object.fromEntries(
        template.schema.fields.flatMap((field) => {
          const value = readFieldValue(field, form);
          return value === undefined ? [] : [[field.key, value]];
        }),
      );
      const payload = {
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? '') || undefined,
        data,
        ...(target.character
          ? {}
          : { templateId: template.templateId, isNPC: target.isNPC }),
      };
      return target.character
        ? api.request<Character>(
            `/characters/${target.character.characterId}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : api.request<Character>(`/campaigns/${campaignId}/characters`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['characters', campaignId],
      });
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  if (!template) {
    return (
      <section className="panel" role="alert">
        <p>{t('characters.templateUnavailable')}</p>
        <button type="button" className="button-ghost" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </section>
    );
  }

  const sections = template.schema.sections ?? [];
  const fieldsForSection = (section?: string) =>
    template.schema.fields.filter((field) => field.section === section);

  return (
    <section className="panel character-editor">
      <div className="section-heading">
        <div>
          <p className="kicker">
            {target.isNPC
              ? t('characters.npc')
              : t('characters.playerCharacter')}
          </p>
          <h2>{t(target.character ? 'characters.edit' : 'characters.new')}</h2>
        </div>
        <button type="button" className="button-ghost" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
      <form onSubmit={(event) => save.mutate(event)}>
        {!target.character && (
          <label>
            {t('characters.template')}
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {availableTemplates.map((item) => (
                <option key={item.templateId} value={item.templateId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('characters.name')}
          <input
            name="name"
            defaultValue={target.character?.name}
            maxLength={100}
            required
          />
        </label>
        <label>
          {t('characters.description')}
          <textarea
            name="description"
            defaultValue={target.character?.description ?? ''}
            maxLength={2000}
          />
        </label>
        {sections.length ? (
          sections.map((section) => (
            <fieldset key={section.key} className="character-fieldset">
              <legend>{section.label}</legend>
              {fieldsForSection(section.key).map((field) => (
                <SchemaField
                  key={field.key}
                  field={field}
                  value={target.character?.data[field.key]}
                />
              ))}
            </fieldset>
          ))
        ) : (
          <fieldset className="character-fieldset">
            <legend>{template.name}</legend>
            {template.schema.fields.map((field) => (
              <SchemaField
                key={field.key}
                field={field}
                value={target.character?.data[field.key]}
              />
            ))}
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={save.isPending}>
          {t(target.character ? 'common.save' : 'characters.create')}
        </button>
      </form>
    </section>
  );
}

function SchemaField({
  field,
  value,
}: {
  field: CharacterField;
  value: unknown;
}) {
  if (field.type === 'boolean') {
    return (
      <label className="checkbox-field">
        <input
          name={field.key}
          type="checkbox"
          defaultChecked={value === true}
        />
        {field.label}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label>
        {field.label}
        <select
          name={field.key}
          defaultValue={typeof value === 'string' ? value : ''}
          required={field.required}
        >
          {!field.required && <option value="" />}
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label>
      {field.label}
      <input
        name={field.key}
        type={field.type === 'number' ? 'number' : 'text'}
        defaultValue={
          typeof value === 'string' || typeof value === 'number' ? value : ''
        }
        min={field.min}
        max={field.max}
        maxLength={field.maxLength}
        required={field.required}
      />
    </label>
  );
}

export function CharactersPage() {
  const { campaignId } = useParams();
  const { api, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [editor, setEditor] = useState<EditorTarget>();
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
  const templates = useQuery({
    queryKey: ['character-templates', campaign.data?.system],
    queryFn: () =>
      api.request<CharacterTemplate[]>(
        `/game-systems/${campaign.data?.system}/templates`,
      ),
    enabled: Boolean(campaign.data?.system),
    retry: false,
  });
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
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  const visibleCharacters = useMemo(() => {
    if (filter === 'players')
      return characters.data?.filter((character) => !character.isNPC);
    if (filter === 'npcs')
      return characters.data?.filter((character) => character.isNPC);
    return characters.data;
  }, [characters.data, filter]);

  if (campaign.isError || characters.isError) {
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  }

  const data = campaign.data;
  const basePath = `/campaigns/${campaignId}`;
  const canAddToBoard = data?.currentUserRole !== 'VIEWER';
  const hasActivePlayerCharacter = characters.data?.some(
    (character) =>
      !character.isNPC &&
      character.isActive &&
      character.ownerId === profile?.userId,
  );

  return (
    <CampaignWorkspaceShell campaign={data}>
      <section className="page-header character-page-header">
        <div>
          <p className="kicker">{t('workspace.characters')}</p>
          <h2>{t('characters.title')}</h2>
        </div>
        <div className="action-row">
          {data?.currentUserRole === 'PLAYER' &&
          templates.data?.length &&
          !hasActivePlayerCharacter ? (
            <button onClick={() => setEditor({ isNPC: false })}>
              {t('characters.newPlayerCharacter')}
            </button>
          ) : null}
          {data?.currentUserRole === 'OWNER' && templates.data?.length ? (
            <button onClick={() => setEditor({ isNPC: true })}>
              {t('characters.newNpc')}
            </button>
          ) : null}
        </div>
      </section>
      {editor ? (
        <CharacterEditor
          target={editor}
          templates={templates.data ?? []}
          onClose={() => setEditor(undefined)}
        />
      ) : null}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="filter-row" aria-label={t('characters.filtersLabel')}>
        {(['all', 'players', 'npcs'] as const).map((item) => (
          <button
            className={filter === item ? '' : 'button-ghost'}
            key={item}
            onClick={() => setFilter(item)}
            type="button"
          >
            {t(`characters.filters.${item}`)}
          </button>
        ))}
      </div>
      {characters.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : visibleCharacters?.length ? (
        <section className="character-list">
          {visibleCharacters.map((character) => {
            const editable = canEdit(
              character,
              profile?.userId,
              data?.currentUserRole ?? 'VIEWER',
            );
            return (
              <article className="character-card" key={character.characterId}>
                <div>
                  <p className="kicker">
                    {character.isNPC
                      ? t('characters.npc')
                      : t('characters.playerCharacter')}
                  </p>
                  <h3>{character.name}</h3>
                  {character.description && <p>{character.description}</p>}
                </div>
                <div className="action-row">
                  {canAddToBoard && (
                    <button
                      className="button-ghost"
                      type="button"
                      onClick={() => addToBoard.mutate(character.characterId)}
                    >
                      {t('characters.addToBoard')}
                    </button>
                  )}
                  {editable && (
                    <button
                      className="button-ghost"
                      type="button"
                      onClick={() =>
                        setEditor({ character, isNPC: character.isNPC })
                      }
                    >
                      {t('common.edit')}
                    </button>
                  )}
                  {editable && (
                    <button
                      className="button-danger"
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            t('characters.deleteConfirmation', {
                              name: character.name,
                            }),
                          )
                        ) {
                          remove.mutate(character.characterId);
                        }
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel empty-state">
          <p>{t('characters.empty')}</p>
        </section>
      )}
    </CampaignWorkspaceShell>
  );
}
