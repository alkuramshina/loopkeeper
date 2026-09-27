import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Logo, LogoMark } from '../components/brand/logo';
import { AccessBadge } from '../components/ui/access-badge';
import { Button } from '../components/ui/button';
import { Chip, ToggleChip } from '../components/ui/chip';
import { EmptyState } from '../components/ui/empty-state';
import { iconProps } from '../components/ui/icon';
import { NewMark } from '../components/ui/new-mark';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Skeleton } from '../components/ui/skeleton';
import { TextField } from '../components/ui/text-field';
import { useToast } from '../components/ui/toast';
import { TypeTag } from '../components/ui/type-tag';
import './ui-gallery.css';

type Variation = 'system' | 'light' | 'dark';

/**
 * Development-only gallery of the primitives in both variations. It is the
 * place to check a token change or a future theme without touching screens.
 * Sample texts are fixtures, so they are not translated.
 */
export function UiGalleryPage() {
  const [variation, setVariation] = useState<Variation>('system');
  const [filter, setFilter] = useState<'all' | 'shared' | 'hidden'>('all');
  const [scared, setScared] = useState(true);
  const toast = useToast();

  const applyVariation = (next: Variation) => {
    setVariation(next);
    if (next === 'system') delete document.documentElement.dataset.variation;
    else document.documentElement.dataset.variation = next;
  };

  return (
    <main className="dev-gallery">
      <header className="dev-gallery-header">
        <Logo label="Loopkeeper" />
        <SegmentedControl
          label="Вариация"
          onChange={applyVariation}
          options={[
            { value: 'system', label: 'Как в системе' },
            { value: 'light', label: 'Светлая' },
            { value: 'dark', label: 'Тёмная' },
          ]}
          value={variation}
        />
      </header>

      <section>
        <h1>Доска расследования</h1>
        <h2>Ферма Ольсенов</h2>
        <h3>Смотритель Берг</h3>
        <p className="dev-gallery-reading">
          Старая молочная ферма у северной дороги, в километре от будки №3.
          Хозяева уехали в прошлом году, но сарай по ночам гудит, как
          трансформатор, а коровы соседей не подходят к ограде ближе чем на
          двадцать шагов.
        </p>
        <p>
          <a href="#links">Ссылка в тексте</a> · <time>20.09.2026, 19:40</time>
        </p>
      </section>

      <section className="dev-gallery-row">
        <Button icon={Plus} variant="primary">
          Материал
        </Button>
        <Button>Добавить на доску</Button>
        <Button variant="quiet">Отмена</Button>
        <Button variant="danger">Удалить</Button>
        <Button disabled variant="primary">
          Сохранение…
        </Button>
      </section>

      <section className="dev-gallery-row">
        <AccessBadge access="SHARED" />
        <AccessBadge access="MASTER_ONLY" />
        <AccessBadge access="PRIVATE" />
        <AccessBadge access="SHARED" variant="visibility" />
        <AccessBadge access="MASTER_ONLY" variant="visibility" />
        <AccessBadge access="PRIVATE" variant="visibility" />
      </section>

      <section className="dev-gallery-row">
        {(
          ['LOCATION', 'NPC', 'NOTE', 'OTHER', 'CHARACTER', 'FREE'] as const
        ).map((type) => (
          <TypeTag key={type} type={type} />
        ))}
        <NewMark />
      </section>

      <section className="dev-gallery-row">
        <SegmentedControl
          label="Фильтр материалов"
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Все', count: 13 },
            { value: 'shared', label: 'Открыто', count: 5 },
            { value: 'hidden', label: 'Скрыто', count: 8 },
          ]}
          value={filter}
        />
        <Chip>подозреваемый</Chip>
        <ToggleChip onToggle={() => setScared(!scared)} pressed={scared}>
          Напугана
        </ToggleChip>
        <ToggleChip onToggle={() => undefined} pressed={false}>
          Ранена
        </ToggleChip>
      </section>

      <section className="dev-gallery-columns">
        <TextField hint="Не меньше 8 символов" label="Пароль" type="password" />
        <TextField error="Проверьте почту" label="Почта" type="email" />
      </section>

      <section className="dev-gallery-columns">
        <div className="dev-gallery-skeleton">
          <Skeleton height="1.5rem" width="40%" />
          <Skeleton height="2.25rem" />
          <Skeleton width="70%" />
          <Skeleton width="55%" />
        </div>
        <EmptyState
          action={
            <Button icon={Plus} variant="primary">
              Первая карточка
            </Button>
          }
          title="На доске пока пусто"
          visual={<FileText {...iconProps} size={32} />}
        >
          <p>
            Начните с того, что уже известно: факт, вопрос или открытый
            материал.
          </p>
        </EmptyState>
      </section>

      <section className="dev-gallery-row">
        <Button
          onClick={() =>
            toast.show({
              message: 'Карточка убрана с доски',
              onUndo: () => toast.show({ message: 'Карточка возвращена' }),
            })
          }
        >
          Показать уведомление
        </Button>
        <LogoMark className="dev-gallery-mark" label="Loopkeeper" />
      </section>
    </main>
  );
}
