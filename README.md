# Loopkeeper

Loopkeeper — backend-сервис для подготовки и ведения настольных ролевых кампаний. Первая поддерживаемая игровая система — **Tales from the Loop**.

Мастер создаёт кампанию и управляет её участниками, заметками, персонажами и материалами. Игроки смогут совместно вести стол расследования — карту заметок, улик, локаций и связей. Кампания является изолированным tenant: пользователь получает доступ к её данным только как владелец или подключённый участник.

## Технологии

- NestJS и TypeScript;
- PostgreSQL и Prisma;
- JWT-аутентификация;
- REST API и Swagger;
- Jest для unit- и e2e-тестов.

## Локальный запуск

Требуются Node.js 22+, Docker и Docker Compose.

1. Создайте `.env` из шаблона `.env.example`.
2. Сгенерируйте и укажите разные значения `JWT_SECRET` и `REFRESH_JWT_SECRET` длиной не менее 20 символов. Например:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

3. Запустите PostgreSQL:

   ```sh
   npm run db:up
   ```

4. Для разработки на хосте примените миграции и запустите API:

   ```sh
   npm run prisma:migrate
   npm run start:dev
   ```

   API будет доступен по `http://localhost:3000`, Swagger — по `http://localhost:3000/docs`.

### Локальный frontend

Лёгкий React/Vite-каркас расположен в `frontend/`. Он использует access JWT только в памяти браузера, а refresh token — через существующую HTTP-only cookie.

1. В первом терминале запустите backend на `http://localhost:3000`.
2. Во втором терминале:

   ```sh
   cd frontend
   cp .env.example .env # при необходимости изменить VITE_API_URL
   npm install
   npm run dev
   ```

Клиент будет доступен на `http://localhost:5173`. Backend по умолчанию разрешает этот origin через CORS. Текущий UI намеренно минимален: auth, список/создание кампаний и read-only shell доски; визуальную систему и полные экраны следует внедрять по спецификации из локального `resources/FRONTEND-SCREENS-AND-UI-PROMPT.md`.

### Запуск в Docker

```sh
docker compose --env-file .env -f deploy/docker-compose.yml up --build
```

Compose поднимает PostgreSQL, применяет committed Prisma migrations в одноразовом сервисе `migrate`, затем запускает API. Readiness endpoint: `GET /health/ready`.

### Команды базы данных

```sh
npm run db:down          # остановить локальный Compose-стек
npm run db:reset         # удалить локальный Docker volume и пересоздать PostgreSQL
npm run prisma:migrate   # создать и применить development migration
npm run prisma:deploy    # применить committed migrations без создания новой
npm run prisma:seed      # применить справочные данные; admin — при SEED_ADMIN=true
```

`prisma:seed` безопасно upsert-ит справочные данные Tales from the Loop и шаблон персонажа `Kid`. Чтобы дополнительно создать локального admin-пользователя, задайте `SEED_ADMIN=true`, `ADMIN_EMAIL` и `ADMIN_PASSWORD` длиной не менее 12 символов. Seed не запускается автоматически и не выводит пароль в лог.

## Аутентификация

- `POST /auth/register` создаёт пользователя, возвращает access token и устанавливает HTTP-only refresh cookie.
- `POST /auth/login` создаёт новую refresh session.
- `POST /auth/refresh` проверяет refresh cookie, отзывает старую session и выдаёт новую пару токенов.
- `POST /auth/logout` требует access token, отзывает текущую refresh session и очищает cookie.
- `POST /auth/change-password` требует access token и отзывает все refresh sessions пользователя.
- `GET /auth/me`, `GET /users/me`, `PATCH /users/me` требуют access token.

Access token передаётся в заголовке `Authorization: Bearer <token>`. Refresh token никогда не возвращается JSON-ответом и хранится на сервере только как Argon2 hash. Auth routes ограничены in-memory rate limiting, а Helmet добавляет базовые HTTP security headers.

## Кампании и персонажи

Кампания — изолированный tenant. Владелец кампании управляет её настройками, участниками, приглашениями и NPC. Участник может состоять в нескольких кампаниях, но API не раскрывает данные чужой кампании и возвращает `404`.

- `PLAYER` может создать и изменить одного активного персонажа в каждой кампании;
- `VIEWER` может читать реестр персонажей, но не изменять его;
- владелец создаёт неограниченное число NPC;
- игровой справочник пока содержит только **Tales from the Loop** и шаблон `Kid`;
- данные листа персонажа валидируются по декларативной схеме выбранного шаблона.

Основные endpoints:

```text
GET    /game-systems
GET    /game-systems/:systemId/templates
POST   /campaigns/:campaignId/characters
GET    /campaigns/:campaignId/characters
GET    /characters/:characterId
PATCH  /characters/:characterId
DELETE /characters/:characterId
```

## Заметки и visibility

Заметки являются кампанийными данными и получают visibility только внутри tenant:

| Visibility    | Доступ                                    |
| ------------- | ----------------------------------------- |
| `PRIVATE`     | Только автор заметки.                     |
| `MASTER_ONLY` | Владелец кампании.                        |
| `PLAYERS`     | Владелец и участники с ролью `PLAYER`.    |
| `PUBLIC`      | Все участники кампании, включая `VIEWER`. |

Владелец создаёт заметки с любой visibility и управляет доступными ему заметками кампании. Игрок создаёт `PRIVATE`, `PLAYERS` и `PUBLIC` заметки и меняет только свои. Наблюдатель имеет доступ только на чтение `PUBLIC` заметок.

```text
POST   /campaigns/:campaignId/notes
GET    /campaigns/:campaignId/notes
GET    /notes/:noteId
PATCH  /notes/:noteId
DELETE /notes/:noteId
```

## Стол расследования

У кампании есть одна общая доска расследования. Карточки универсальны: ими можно описывать NPC, улику, локацию, событие или любую гипотезу без создания отдельного backend-типа. У карточки есть содержание, свободные теги, hex-цвет, ключ иконки и сохранённая раскладка.

Владелец и `PLAYER` совместно создают, изменяют и удаляют любые карточки и ненаправленные связи. `VIEWER` и внешний пользователь не имеют доступа. Дублирующая связь и связь карточки с самой собой отклоняются API.

```text
GET    /campaigns/:campaignId/investigation-board
POST   /campaigns/:campaignId/investigation-cards
PATCH  /investigation-cards/:cardId
DELETE /investigation-cards/:cardId
POST   /campaigns/:campaignId/investigation-links
PATCH  /investigation-links/:linkId
DELETE /investigation-links/:linkId
PATCH  /investigation-board/nodes/:cardId
```

## API-документация

Swagger доступен на `http://localhost:3000/docs`. Для защищённых маршрутов используйте кнопку **Authorize** и security scheme `access-token`, передав только access JWT в формате `Bearer <token>`. Refresh token хранится в HTTP-only cookie и в Swagger не вводится.

## E2E-тесты

E2E используют отдельный PostgreSQL service и только базу `loopkeeper_test`; перед любым destructive действием тесты проверяют её имя.

```sh
npm run db:test:up
npm run test:e2e
npm run db:test:down # остановить только postgres-test
```

Jest перед тестами применяет committed migrations, а перед каждым сценарием очищает тестовую БД и создаёт необходимые fixtures. Запуск не затрагивает development БД `loopkeeper`.

## Текущий статус

Backend MVP готов: инфраструктура NestJS/Prisma, безопасная JWT-аутентификация с rotating refresh sessions, tenant-кампании, участники и одноразовые приглашения, Tales from the Loop персонажи и NPC, заметки с visibility и совместный стол расследования. Отдельные раздатки и timeline в MVP не планируются. Следующий продуктовый шаг — локальный фронтенд; расширения realtime и инфраструктуры описаны отдельным локальным планом.
