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
npm run prisma:seed      # создать admin только при SEED_ADMIN=true
```

`prisma:seed` требует `SEED_ADMIN=true`, `ADMIN_EMAIL` и `ADMIN_PASSWORD` длиной не менее 12 символов. Seed не запускается автоматически и не выводит пароль в лог.

## E2E-тесты

E2E используют отдельный PostgreSQL service и только базу `loopkeeper_test`; перед любым destructive действием тесты проверяют её имя.

```sh
npm run db:test:up
npm run test:e2e
npm run db:test:down # остановить только postgres-test
```

Jest перед тестами применяет committed migrations, а перед каждым сценарием очищает тестовую БД и создаёт необходимые fixtures. Запуск не затрагивает development БД `loopkeeper`.

## Текущий статус

Базовая инфраструктура NestJS/Prisma, JWT login/refresh, пользователи и начальный CRUD кампаний уже присутствуют. MVP ещё не завершён: прежде всего требуются единый auth-контракт, tenant-права, участники кампаний и игровые домены.
