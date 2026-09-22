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

## E2E-тесты

E2E используют отдельный PostgreSQL service и только базу `loopkeeper_test`; перед любым destructive действием тесты проверяют её имя.

```sh
npm run db:test:up
npm run test:e2e
npm run db:test:down # остановить только postgres-test
```

Jest перед тестами применяет committed migrations, а перед каждым сценарием очищает тестовую БД и создаёт необходимые fixtures. Запуск не затрагивает development БД `loopkeeper`.

## Текущий статус

Готовы базовая инфраструктура NestJS/Prisma, безопасная JWT-аутентификация с rotating refresh sessions, tenant-кампании, участники и одноразовые приглашения, а также Tales from the Loop персонажи и NPC. Следующий backend-этап MVP — заметки и правила visibility; после стабилизации контрактов персонажей можно начинать локальный фронтенд.
