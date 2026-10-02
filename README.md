# Loopkeeper

Loopkeeper — веб-приложение для совместного ведения нарративных ролевых кампаний, где важнее история, загадка и атмосфера, чем статы и броски. Первая поддерживаемая система — **Tales from the Loop**.

## Что умеет

- **Кампании и участники.** Мастер создаёт кампанию и приглашает людей по одноразовой ссылке: игроков или наблюдателей. Каждая кампания изолирована от остальных.
- **Материалы кампании.** Мастер ведёт заметки, локации (с картой), NPC и прочие материалы. По умолчанию их видит только он, а когда нужно — открывает участникам.
- **Дело и заметки игрока.** Игрок видит открытые материалы в «Деле», от новых к старым, и ведёт свои заметки: личные, для мастера или для всех. Быструю заметку можно записать прямо во время сцены.
- **Персонажи.** У каждого игрока свой лист персонажа по шаблону системы.
- **Доска расследования.** Мастер и игроки вместе выкладывают на общую доску карточки: свои записи, открытые материалы и персонажей. Карточки можно двигать, помечать тегами и цветом и соединять подписанными связями.
- **Оформление.** Обложка кампании, аватары и фоны рабочего пространства.

Изменения на доске пока не приходят в реальном времени: чтобы увидеть правки других участников, нажмите «Обновить».

## Стек

- Backend: NestJS, TypeScript, PostgreSQL, Prisma.
- Frontend: React, Vite, TanStack Query, React Flow.
- Тесты: Jest (backend), Vitest и Testing Library (frontend), Playwright (браузерные сценарии).

## Быстрый старт

Нужны Node.js 22+ и Docker.

1. Скопируйте `.env.example` в `.env` и задайте `JWT_SECRET`, `REFRESH_JWT_SECRET` и `INVITATION_SECRET` — три разные случайные строки не короче 20 символов:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Запустите базу данных, примените миграции и справочные данные, запустите API:

   ```sh
   npm install
   npm run db:up
   npm run prisma:deploy
   npm run prisma:seed
   npm run start:dev
   ```

   API работает на `http://localhost:3000`, документация Swagger — на `http://localhost:3000/docs`.

3. В другом терминале запустите интерфейс:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Откройте `http://localhost:5173`.

### Всё в Docker

```sh
docker compose --env-file .env -f deploy/docker-compose.yml up --build
```

Поднимает PostgreSQL, применяет миграции и запускает API.

## Тесты

```sh
npm test                 # unit-тесты backend
npm run db:test:up       # отдельная тестовая база
npm run test:e2e         # e2e-тесты backend
npm run db:test:down

cd frontend && npm test  # тесты интерфейса
```

E2E-тесты работают только с базой `loopkeeper_test` и не трогают рабочие данные.

### Браузерные тесты (Playwright)

```sh
npm run db:test:up
cd frontend
npm run test:e2e                  # или test:e2e:ui для интерактивного режима
```

Playwright сам поднимает отдельный API на порту `3100` (база `loopkeeper_test` мигрируется и очищается перед запуском) и Vite на порту `5174`, поэтому рабочие серверы и данные не затрагиваются. Локально тесты запускаются в установленном Google Chrome, скачивать браузер не нужно. В CI используется Chromium от Playwright; локально его можно выбрать через `npx playwright install chromium` и `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

## Полезные команды

| Команда                  | Что делает                                        |
| ------------------------ | ------------------------------------------------- |
| `npm run db:down`        | Остановить контейнеры                             |
| `npm run db:reset`       | Удалить локальную базу и создать её заново        |
| `npm run prisma:migrate` | Создать и применить новую миграцию при разработке |
| `npm run prisma:studio`  | Открыть просмотр базы в браузере                  |

## Entity views and campaign visits

An entity is new for a campaign member when it is visible, was authored by someone else, and has no view record for that membership. Elements, board cards and board links return a required boolean `isNew`; characters are excluded. Reading a list, fetching a detail, or previewing a referenced source never records a view by itself.

`POST /campaigns/:campaignId/views` accepts `{ "entities": [{ "entityType": "ELEMENT", "entityId": "uuid" }] }`, with 1–500 entries. Types are `ELEMENT`, `BOARD_CARD` and `BOARD_LINK`. All member roles may record their own views. A successful atomic batch returns `204`; duplicates and concurrent repeats preserve the first server timestamp. An inaccessible entity, missing ID or foreign campaign ID returns `404 views.entity_not_found`; nonmembers receive `404 campaign.not_found`.

The frontend records an element after rendering its detail and records only the cards and links in a rendered board response, in batches of at most 500. Board highlights persist through technical refetches until manual refresh or leaving the board. A reference card's view is independent of the source element's view. Hiding an element preserves its views while removing its reference cards, links and their views transactionally.

Campaign responses include `lastVisitAt: string | null` and `newVisibleMaterialCount`, counting all visible unviewed elements by other authors, including player notes addressed to the master. `POST /campaigns/:campaignId/visit` returns `{ "lastVisitAt": "ISO date-time" }` and only records a server-time visit; visits do not change views. `sharedAt` remains the last transition to `SHARED` for sorting and display and is cleared when an element is hidden.
