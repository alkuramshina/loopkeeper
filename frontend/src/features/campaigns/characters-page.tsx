import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { PageHeader } from '../../components/page-header';
import { Avatar } from '../../components/avatar';
import { ModalDialog } from '../../components/modal-dialog';
import { MediaUpload } from '../../components/media-upload';
import { PageError } from '../../components/page-error';
import { formText } from '../../components/form-text';
import './characters-redesign.css';

type EditorTarget = {
  character?: Character;
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
  return role === 'PLAYER' && character.ownerId === profileId;
}

function readFieldValue(field: CharacterField, form: FormData): unknown {
  if (field.type === 'boolean') return form.get(field.key) === 'on';

  const value = formText(form, field.key).trim();
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

  const [templateId, setTemplateId] = useState(
    target.character?.templateId ?? templates[0]?.templateId ?? '',
  );
  const [error, setError] = useState<string>();
  const template = templates.find((item) => item.templateId === templateId);

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (!campaignId || !template) return;
      const data = Object.fromEntries(
        template.schema.fields.flatMap((field) => {
          const value = readFieldValue(field, form);
          return value === undefined ? [] : [[field.key, value]];
        }),
      );
      const payload = {
        name: formText(form, 'name'),
        description: formText(form, 'description') || undefined,
        data,
        ...(target.character ? {} : { templateId: template.templateId }),
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
      <ModalDialog onClose={onClose} title={t('characters.new')}>
        <p className="modal-dialog-message" role="alert">
          {t('characters.templateUnavailable')}
        </p>
      </ModalDialog>
    );
  }

  const sections = template.schema.sections ?? [];
  const fieldsForSection = (section?: string) =>
    template.schema.fields.filter((field) => field.section === section);

  return (
    <ModalDialog
      onClose={onClose}
      title={t(target.character ? 'characters.edit' : 'characters.new')}
    >
      <form
        className="character-editor"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          save.mutate(new FormData(event.currentTarget));
        }}
      >
        {!target.character && (
          <label>
            {t('characters.template')}
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {templates.map((item) => (
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
    </ModalDialog>
  );
}

function SchemaField({
  field,
  value,
  disabled,
}: {
  field: CharacterField;
  value: unknown;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const label = t(`characters.fields.${field.key}`, {
    defaultValue: field.label,
  });
  if (field.type === 'boolean') {
    return (
      <label className="checkbox-field">
        <input
          name={field.key}
          type="checkbox"
          defaultChecked={value === true}
          disabled={disabled}
        />
        {label}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label>
        {label}
        <select
          name={field.key}
          defaultValue={typeof value === 'string' ? value : ''}
          required={field.required}
          disabled={disabled}
        >
          {!field.required && <option value="" />}
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {t(`characters.options.${option}`, { defaultValue: option })}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label>
      {label}
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
        disabled={disabled}
      />
    </label>
  );
}

function CharacterDetail({
  character,
  template,
  editable,
  canAddToBoard,
  onAddToBoard,
  onDelete,
}: {
  character: Character;
  template?: CharacterTemplate;
  editable: boolean;
  canAddToBoard: boolean;
  onAddToBoard: () => void;
  onDelete: () => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [conditions, setConditions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (template?.schema.fields ?? [])
        .filter(
          (field) => field.section === 'conditions' && field.type === 'boolean',
        )
        .map((field) => [field.key, character.data[field.key] === true]),
    ),
  );
  const fields = template?.schema.fields ?? [];
  const conditionFields = fields.filter(
    (field) => field.section === 'conditions' && field.type === 'boolean',
  );
  const ordinaryFields = fields.filter(
    (field) => field.section !== 'conditions',
  );
  const sections = [
    ...new Set([
      'attributes',
      'skills',
      'identity',
      ...ordinaryFields.map((field) => field.section ?? 'other'),
    ]),
  ].filter((section) =>
    ordinaryFields.some((field) => (field.section ?? 'other') === section),
  );
  const save = (nextConditions = conditions) => {
    const form = formRef.current;
    if (!form || !form.checkValidity()) return;
    dirty.current = false;
    const values = new FormData(form);
    const data: Record<string, unknown> = {
      ...character.data,
      ...nextConditions,
    };
    for (const field of ordinaryFields) {
      const value = readFieldValue(field, values);
      if (value === undefined) delete data[field.key];
      else data[field.key] = value;
    }
    const payload = {
      name: formText(values, 'name').trim(),
      description: formText(values, 'description'),
      data,
    };
    if (!payload.name) return;
    setStatus('saving');
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        const updated = await api.request<Character>(
          `/characters/${character.characterId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          },
        );
        queryClient.setQueryData<Character[]>(
          ['characters', campaignId],
          (current) =>
            current?.map((item) =>
              item.characterId === updated.characterId ? updated : item,
            ),
        );
        void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
        setStatus('saved');
      })
      .catch(() => setStatus('error'));
  };
  const scheduleSave = () => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      save();
    }, 700);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="character-detail">
      <Link className="button-ghost" to={`/campaigns/${campaignId}/characters`}>
        ← {t('characters.title')}
      </Link>
      <div className="character-detail-heading">
        <Avatar
          alt={character.name}
          imageUrl={character.avatarUrl}
          seed={character.characterId}
          size="large"
        />
        <div>
          <p className="muted">{t('characters.playerCharacter')}</p>
          <h2>{character.name}</h2>
        </div>
        {canAddToBoard && (
          <button type="button" onClick={onAddToBoard}>
            {t('characters.addToBoard')}
          </button>
        )}
      </div>
      {editable && (
        <MediaUpload
          endpoint={`/characters/${character.characterId}/avatar`}
          hasImage={Boolean(character.avatarUrl?.startsWith('/media/'))}
          label={t('characters.avatar')}
          onChanged={() =>
            queryClient.invalidateQueries({
              queryKey: ['characters', campaignId],
            })
          }
        />
      )}
      <form
        ref={formRef}
        className="character-detail-form"
        onChange={editable ? scheduleSave : undefined}
        onBlurCapture={
          editable
            ? () => {
                if (dirty.current) {
                  if (timer.current) clearTimeout(timer.current);
                  save();
                }
              }
            : undefined
        }
      >
        <section className="character-detail-section character-detail-story">
          <h3>{t('characters.story')}</h3>
          <label>
            {t('characters.name')}
            <input
              name="name"
              defaultValue={character.name}
              maxLength={100}
              required
              disabled={!editable}
            />
          </label>
          <label>
            {t('characters.description')}
            <textarea
              name="description"
              defaultValue={character.description ?? ''}
              maxLength={2000}
              disabled={!editable}
            />
          </label>
          {ordinaryFields
            .filter((field) => field.section === 'story')
            .map((field) => (
              <SchemaField
                key={field.key}
                field={field}
                value={character.data[field.key]}
                disabled={!editable}
              />
            ))}
        </section>
        {conditionFields.length > 0 && (
          <section className="character-detail-section">
            <h3>{t('case.character.conditions')}</h3>
            <div className="character-condition-list">
              {conditionFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  disabled={!editable}
                  aria-pressed={conditions[field.key] === true}
                  onClick={() => {
                    const next = {
                      ...conditions,
                      [field.key]: !conditions[field.key],
                    };
                    setConditions(next);
                    if (timer.current) clearTimeout(timer.current);
                    save(next);
                  }}
                >
                  {t(`case.character.condition.${field.key}`, {
                    defaultValue: field.label,
                  })}
                </button>
              ))}
            </div>
          </section>
        )}
        {sections
          .filter((section) => section !== 'story')
          .map((section) => {
            const sectionFields = ordinaryFields.filter(
              (field) => (field.section ?? 'other') === section,
            );
            return (
              <section className="character-detail-section" key={section}>
                <h3>
                  {t(`characters.sections.${section}`, {
                    defaultValue:
                      template?.schema.sections?.find(
                        (item) => item.key === section,
                      )?.label ?? section,
                  })}
                </h3>
                <div className="character-detail-fields">
                  {sectionFields.map((field) => (
                    <SchemaField
                      key={field.key}
                      field={field}
                      value={character.data[field.key]}
                      disabled={!editable}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        {editable && (
          <p className="character-save-status" role="status">
            {status === 'saving'
              ? t('characters.saving')
              : status === 'saved'
                ? t('characters.saved')
                : status === 'error'
                  ? t('characters.saveError')
                  : t('characters.autoSave')}
          </p>
        )}
      </form>
      {editable && (
        <button className="button-danger" type="button" onClick={onDelete}>
          {t('common.delete')}
        </button>
      )}
    </div>
  );
}

export function CharactersPage() {
  const { campaignId, characterId } = useParams();
  const navigate = useNavigate();
  const { api, profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
      if (characterId)
        void navigate(`/campaigns/${campaignId}/characters`, { replace: true });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  if (campaign.isError || characters.isError || templates.isError) {
    return (
      <PageError
        error={
          campaign.error ?? characters.error ?? templates.error ?? undefined
        }
        onRetry={() => {
          void campaign.refetch();
          void characters.refetch();
          void templates.refetch();
        }}
      />
    );
  }

  const data = campaign.data;

  const canAddToBoard =
    data?.currentUserRole === 'OWNER' || data?.currentUserRole === 'PLAYER';
  const hasActivePlayerCharacter = characters.data?.some(
    (character) => character.isActive && character.ownerId === profile?.userId,
  );
  const selected = characters.data?.find(
    (character) => character.characterId === characterId,
  );
  const selectedTemplate = templates.data?.find(
    (item) => item.templateId === selected?.templateId,
  );

  return (
    <CampaignWorkspaceShell campaign={data}>
      <PageHeader
        title={t('characters.title')}
        actions={
          data?.currentUserRole === 'PLAYER' &&
          templates.data?.length &&
          !hasActivePlayerCharacter ? (
            <button onClick={() => setEditor({})}>
              {t('characters.newPlayerCharacter')}
            </button>
          ) : null
        }
      />
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

      {characters.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : characterId && !selected ? (
        <PageError />
      ) : selected && !selectedTemplate && templates.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : selected ? (
        <CharacterDetail
          key={selected.characterId}
          character={selected}
          template={selectedTemplate}
          editable={canEdit(
            selected,
            profile?.userId,
            data?.currentUserRole ?? 'VIEWER',
          )}
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
      ) : characters.data?.length ? (
        <section className="character-list">
          {characters.data.map((character) => {
            const editable = canEdit(
              character,
              profile?.userId,
              data?.currentUserRole ?? 'VIEWER',
            );
            return (
              <article className="character-card" key={character.characterId}>
                <div className="character-card-identity">
                  <Avatar
                    alt={character.name}
                    imageUrl={character.avatarUrl}
                    seed={character.characterId}
                  />
                  <div>
                    <p className="kicker">{t('characters.playerCharacter')}</p>
                    <h3>
                      <Link
                        to={`/campaigns/${campaignId}/characters/${character.characterId}`}
                      >
                        {character.name}
                      </Link>
                    </h3>
                    {character.description && <p>{character.description}</p>}
                  </div>
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
                        void navigate(
                          `/campaigns/${campaignId}/characters/${character.characterId}`,
                        )
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
