import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ArrowLeft, LayoutDashboard, Trash2 } from 'lucide-react';
import { ApiError, Character } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { Avatar } from '../../components/avatar';
import { MediaUpload } from '../../components/media-upload';
import { formText } from '../../components/form-text';
import { Button } from '../../components/ui/button';
import { iconProps } from '../../components/ui/icon';
import { talesFromTheLoop, type CharacterField } from './tales-from-the-loop';

export function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function readFieldValue(field: CharacterField, form: FormData): unknown {
  if (field.type === 'boolean') return form.get(field.key) === 'on';

  const value = formText(form, field.key).trim();
  if (!value && !field.required) return undefined;
  return field.type === 'number' ? Number(value) : value;
}

const isCondition = (field: CharacterField) =>
  field.section === 'conditions' && field.type === 'boolean';

function useFieldLabel() {
  const { t } = useTranslation();
  return (field: CharacterField) =>
    t(`characters.fields.${field.key}`, { defaultValue: field.label });
}

/** "Bookworm · 12 years · played by Liza" under the name, in the list and the detail. */
export function useCharacterMeta() {
  const { t } = useTranslation();
  return (character: Character) => {
    const { type, age } = character.data;
    return [
      typeof type === 'string' &&
        t(`characters.options.${type}`, { defaultValue: type }),
      typeof age === 'number' && t('characters.age', { count: age }),
      character.owner?.name &&
        t('characters.playedBy', { name: character.owner.name }),
    ]
      .filter(Boolean)
      .join(' · ');
  };
}

function SchemaField({
  field,
  value,
}: {
  field: CharacterField;
  value: unknown;
}) {
  const { t } = useTranslation();
  const label = useFieldLabel()(field);

  if (field.type === 'select') {
    return (
      <label className="character-field">
        <span>{label}</span>
        <select
          name={field.key}
          defaultValue={typeof value === 'string' ? value : ''}
          required={field.required}
        >
          <option value="" disabled={field.required}>
            {field.required ? t('characters.choose') : ''}
          </option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {t(`characters.options.${option}`, { defaultValue: option })}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const text = typeof value === 'string' || typeof value === 'number';
  if (field.type === 'string' && (field.maxLength ?? 0) > 200) {
    return (
      <label className="character-field">
        <span>{label}</span>
        <textarea
          name={field.key}
          defaultValue={text ? String(value) : ''}
          maxLength={field.maxLength}
          required={field.required}
          rows={2}
        />
      </label>
    );
  }
  return (
    <label className="character-field">
      <span>{label}</span>
      <input
        name={field.key}
        type={field.type === 'number' ? 'number' : 'text'}
        defaultValue={text ? value : ''}
        min={field.min}
        max={field.max}
        maxLength={field.maxLength}
        required={field.required}
      />
    </label>
  );
}

/**
 * A number of the sheet (an attribute or a skill) as a compact tile: the
 * number big, the name under it.
 */
function NumberTile({
  field,
  value,
  editable,
}: {
  field: CharacterField;
  value: unknown;
  editable: boolean;
}) {
  const label = useFieldLabel()(field);
  return editable ? (
    <label className="character-tile">
      <input
        name={field.key}
        type="number"
        defaultValue={typeof value === 'number' ? value : ''}
        min={field.min}
        max={field.max}
        placeholder="–"
      />
      <span>{label}</span>
    </label>
  ) : (
    <div className="character-tile">
      <strong>{typeof value === 'number' ? value : '–'}</strong>
      <span>{label}</span>
    </div>
  );
}

/**
 * The first thing a player without a character sees: who the kid is. Only
 * the name, age and type are required; the rest can wait for the detail.
 */
export function TalesFromTheLoopCreate() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const label = useFieldLabel();

  const save = useMutation({
    mutationFn: (form: FormData) => {
      const data = Object.fromEntries(
        talesFromTheLoop.fields.flatMap((field) => {
          const value = readFieldValue(field, form);
          return value === undefined || isCondition(field)
            ? []
            : [[field.key, value]];
        }),
      );
      return api.request<Character>(`/campaigns/${campaignId}/characters`, {
        method: 'POST',
        body: JSON.stringify({
          name: formText(form, 'name').trim(),
          description: formText(form, 'description').trim() || undefined,
          data,
        }),
      });
    },
    onSuccess: (created) => {
      // The detail reads the list, so the new character is there before the
      // refetch.
      queryClient.setQueryData<Character[]>(
        ['characters', campaignId],
        (current) => [...(current ?? []), created],
      );
      void queryClient.invalidateQueries({
        queryKey: ['characters', campaignId],
      });
      void navigate(
        `/campaigns/${campaignId}/characters/${created.characterId}`,
      );
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  const fields = talesFromTheLoop.fields.filter((field) => !isCondition(field));
  const identity = fields.filter((field) => field.section === 'identity');
  const numbers = fields.filter(
    (field) => field.section === 'attributes' || field.section === 'skills',
  );
  const rest = fields.filter(
    (field) => !identity.includes(field) && !numbers.includes(field),
  );

  return (
    <form
      aria-labelledby="character-create-title"
      className="character-create"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(undefined);
        save.mutate(new FormData(event.currentTarget));
      }}
    >
      <div>
        <h2 id="character-create-title">{t('characters.new')}</h2>
        <p className="muted">{t('characters.newLead')}</p>
      </div>
      <div className="character-create-identity">
        <label className="character-field">
          <span>{t('characters.name')}</span>
          <input autoFocus maxLength={100} name="name" required />
        </label>
        {identity.map((field) => (
          <SchemaField field={field} key={field.key} value={undefined} />
        ))}
      </div>
      <details className="character-create-more">
        <summary>{t('characters.more')}</summary>
        <label className="character-field">
          <span>{t('characters.description')}</span>
          <textarea maxLength={2000} name="description" rows={2} />
        </label>
        {rest.map((field) => (
          <SchemaField field={field} key={field.key} value={undefined} />
        ))}
        {numbers.length > 0 && (
          <fieldset className="character-create-numbers">
            <legend>
              {t('characters.sections.attributes')} ·{' '}
              {t('characters.sections.skills')}
            </legend>
            {numbers.map((field) => (
              <label className="character-field" key={field.key}>
                <span>{label(field)}</span>
                <input
                  max={field.max}
                  min={field.min}
                  name={field.key}
                  type="number"
                />
              </label>
            ))}
          </fieldset>
        )}
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <Button disabled={save.isPending} type="submit" variant="primary">
          {t('characters.create')}
        </Button>
      </div>
    </form>
  );
}

export function TalesFromTheLoopDetail({
  character,
  editable,
  onBoard,
  canAddToBoard,
  onAddToBoard,
  onDelete,
}: {
  character: Character;
  editable: boolean;
  onBoard: boolean;
  canAddToBoard: boolean;
  onAddToBoard: () => void;
  onDelete: () => void;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const label = useFieldLabel();
  const meta = useCharacterMeta();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const fields = talesFromTheLoop.fields;
  const conditionFields = fields.filter(isCondition);
  const ordinaryFields = fields.filter((field) => !isCondition(field));
  const [conditions, setConditions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      conditionFields.map((field) => [
        field.key,
        character.data[field.key] === true,
      ]),
    ),
  );
  const identity = ordinaryFields.filter(
    (field) => field.section === 'identity',
  );
  const attributes = ordinaryFields.filter(
    (field) => field.section === 'attributes',
  );
  const skills = ordinaryFields.filter((field) => field.section === 'skills');
  const story = ordinaryFields.filter(
    (field) =>
      !identity.includes(field) &&
      !attributes.includes(field) &&
      !skills.includes(field),
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

  const text = (key: string) => {
    const value = character.data[key];
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  };
  const filledSkills = skills.filter(
    (field) =>
      typeof character.data[field.key] === 'number' &&
      (character.data[field.key] as number) > 0,
  );
  const readFacts = [
    ...(character.description
      ? [
          {
            key: 'description',
            label: t('characters.description'),
            value: character.description,
          },
        ]
      : []),
    ...story
      .filter((field) => text(field.key))
      .map((field) => ({
        key: field.key,
        label: label(field),
        value: text(field.key),
      })),
  ];

  return (
    <article aria-label={character.name} className="character-detail">
      {/* Below 1024 the list and the sheet are separate screens. */}
      <Link
        className="material-back character-back"
        to={`/campaigns/${campaignId}/characters`}
      >
        <ArrowLeft {...iconProps} />
        {t('characters.backToList')}
      </Link>
      <form
        ref={formRef}
        className="character-sheet"
        onChange={editable ? scheduleSave : undefined}
        onSubmit={(event) => event.preventDefault()}
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
        <div className="character-heading">
          <Avatar
            alt={character.name}
            imageUrl={character.avatarUrl}
            seed={character.characterId}
            size="large"
          />
          <div className="character-heading-text">
            <h2>{character.name}</h2>
            {meta(character) && (
              <p className="character-meta">{meta(character)}</p>
            )}
          </div>
          {(editable || (canAddToBoard && !onBoard)) && (
            <div className="character-heading-actions">
              {editable && (
                <span className="material-save-status" role="status">
                  {status === 'saving'
                    ? t('characters.saving')
                    : status === 'saved'
                      ? t('characters.saved')
                      : status === 'error'
                        ? t('characters.saveError')
                        : t('characters.autoSave')}
                </span>
              )}
              {canAddToBoard && !onBoard && (
                <Button icon={LayoutDashboard} onClick={onAddToBoard}>
                  {t('characters.addToBoard')}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="character-main">
          {editable ? (
            <div className="character-facts character-facts-edit">
              <label className="character-field">
                <span>{t('characters.name')}</span>
                <input
                  name="name"
                  defaultValue={character.name}
                  maxLength={100}
                  required
                />
              </label>
              {identity.map((field) => (
                <SchemaField
                  field={field}
                  key={field.key}
                  value={character.data[field.key]}
                />
              ))}
              <label className="character-field">
                <span>{t('characters.description')}</span>
                <textarea
                  name="description"
                  defaultValue={character.description ?? ''}
                  maxLength={2000}
                  rows={2}
                />
              </label>
              {story.map((field) => (
                <SchemaField
                  field={field}
                  key={field.key}
                  value={character.data[field.key]}
                />
              ))}
            </div>
          ) : readFacts.length > 0 ? (
            <dl className="character-facts">
              {readFacts.map((fact) => (
                <div key={fact.key}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">{t('characters.noStory')}</p>
          )}

          <div className="character-side">
            {conditionFields.length > 0 && (
              <section aria-labelledby="character-conditions">
                <h3 className="character-side-title" id="character-conditions">
                  {t('case.character.conditions')}
                </h3>
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
            {attributes.length > 0 && (
              <section aria-labelledby="character-attributes">
                <h3 className="character-side-title" id="character-attributes">
                  {t('characters.sections.attributes')}
                </h3>
                <div className="character-tiles">
                  {attributes.map((field) => (
                    <NumberTile
                      editable={editable}
                      field={field}
                      key={field.key}
                      value={character.data[field.key]}
                    />
                  ))}
                </div>
              </section>
            )}
            {skills.length > 0 && (editable || filledSkills.length > 0) && (
              <section aria-labelledby="character-skills">
                <h3 className="character-side-title" id="character-skills">
                  {t('characters.sections.skills')}
                </h3>
                {editable ? (
                  <div className="character-skill-inputs">
                    {skills.map((field) => (
                      <label key={field.key}>
                        <span>{label(field)}</span>
                        <input
                          defaultValue={
                            typeof character.data[field.key] === 'number'
                              ? (character.data[field.key] as number)
                              : ''
                          }
                          max={field.max}
                          min={field.min}
                          name={field.key}
                          placeholder="–"
                          type="number"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="character-skills">
                    {filledSkills.map((field, index) => (
                      <span key={field.key}>
                        {index > 0 && ' · '}
                        <span className="character-skill">
                          {label(field)} {character.data[field.key] as number}
                        </span>
                      </span>
                    ))}
                  </p>
                )}
              </section>
            )}
            {editable && (
              <section className="character-avatar">
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
              </section>
            )}
          </div>
        </div>
      </form>
      {editable && (
        <footer className="character-footer">
          <Button icon={Trash2} onClick={onDelete} variant="quiet">
            {t('characters.delete')}
          </Button>
        </footer>
      )}
    </article>
  );
}
