# Проект: Loopkeeper

## Назначение

**Loopkeeper** — backend-сервис для подготовки и ведения настольных ролевых игр.

Система позволяет мастеру:

* создавать игровые кампании;
* приглашать игроков;
* создавать персонажей по шаблонам игровых систем;
* хранить игровые материалы;
* вести заметки;
* управлять видимостью информации;
* публиковать раздаточные материалы.

Первый поддерживаемый игровой шаблон:

> Tales from the Loop

Архитектура должна позволять в будущем добавлять другие системы:

* D&D;
* Call of Cthulhu;
* Fate;
* другие.

---

# Цели проекта

## Учебные

Освоить разработку backend-приложения на:

* NestJS;
* TypeScript;
* Prisma;
* PostgreSQL;
* JWT;
* REST API;
* Guards;
* Dependency Injection;
* модульную архитектуру;
* тестирование;
* Docker.

---

## Пользовательские

Получить рабочий инструмент для подготовки кампаний.

---

# MVP Scope

В MVP входят:

## 1. Пользователи

### Возможности

* регистрация;
* авторизация;
* получение профиля;
* изменение профиля.

### Модель

```
User

id
email
passwordHash
name
createdAt
updatedAt
```

---

# 2. Аутентификация

Используется:

* JWT access token;
* refresh token (можно добавить после MVP).

---

## API

```
POST /auth/register

POST /auth/login

POST /auth/logout

GET /auth/me
```

---

# 3. Кампании

Кампания — отдельная игровая история.

Пример:

```
Campaign:

The Four Seasons of Mad Science

System:
Tales from the Loop

Master:
Aliya
```

---

## Модель

```
Campaign

id

name

description

systemId

ownerId

createdAt
```

---

## API

```
POST /campaigns

GET /campaigns

GET /campaigns/:id

PATCH /campaigns/:id

DELETE /campaigns/:id
```

---

# 4. Участники кампании

Пользователь может иметь роль:

```
MASTER
PLAYER
VIEWER
```

---

Модель:

```
CampaignMember

id

campaignId

userId

role

createdAt
```

---

Пример:

```
Loop Campaign

Aliya
 MASTER

Ivan
 PLAYER

Guest
 VIEWER
```

---

API:

```
POST /campaigns/:id/members

GET /campaigns/:id/members

PATCH /campaigns/:id/members/:userId

DELETE /campaigns/:id/members/:userId
```

---

# 5. Игровые системы и шаблоны

Главная архитектурная часть.

Система не должна знать конкретно про Tales from the Loop.

## Game System

```
GameSystem

id

name

description
```

Пример:

```
Tales from the Loop
```

---

## Character Template

Шаблон персонажа.

```
CharacterTemplate

id

systemId

name

schema JSONB
```

---

Пример:

```json
{
 "fields":[
   {
    "name":"pride",
    "type":"text",
    "required":true
   },

   {
    "name":"problem",
    "type":"text"
   },

   {
    "name":"age",
    "type":"number"
   }
 ]
}
```

---

# 6. Персонажи

Игрок создает персонажа по шаблону.

---

Модель:

```
Character

id

campaignId

ownerId

templateId

name

data JSONB
```

---

Пример:

```json
{
"name":"Mika",

"age":13,

"pride":
"I understand machines",

"problem":
"My parents ignore me"
}
```

---

API:

```
POST /characters

GET /characters/:id

PATCH /characters/:id

DELETE /characters/:id
```

---

# 7. Заметки

Основной инструмент мастера.

Типы:

```
PRIVATE

MASTER_ONLY

PLAYERS

PUBLIC
```

---

Модель:

```
Note

id

campaignId

authorId

title

content

visibility

createdAt
updatedAt
```

---

Примеры:

Мастер:

```
Лена является антагонистом
```

visibility:

```
MASTER_ONLY
```

---

Игрок:

```
Дети нашли странную лабораторию
```

visibility:

```
PLAYERS
```

---

API:

```
POST /notes

GET /campaigns/:id/notes

PATCH /notes/:id

DELETE /notes/:id
```

---

# 8. Раздаточные материалы

Хранение:

* изображений;
* документов;
* карт;
* аудио.

---

Модель:

```
Handout

id

campaignId

title

description

fileUrl

visibility
```

---

Пример:

```
Фотография робота

Доступ:
PLAYERS
```

---

API:

```
POST /handouts

GET /campaigns/:id/handouts

GET /handouts/:id/file
```

---

# 9. Локации

Для расследований.

---

Модель:

```
Location

id

campaignId

name

description

secretDescription
```

---

Пример:

Игрок:

```
Старая лаборатория Loop

Заброшенное здание
```

Мастер:

```
Подвал содержит управляющий компьютер
```

---

# 10. История событий

Журнал кампании.

```
TimelineEvent

id

campaignId

title

description

createdAt
```

---

Пример:

```
12 августа

Игроки нашли странный сигнал
```

---

# Архитектура backend

```
src

 auth
 users

 campaigns
 members

 characters
 templates
 systems

 notes
 handouts
 locations
 timeline

 common

 prisma
```

---

# Технические требования

## Backend

NestJS:

* REST API;
* Swagger;
* глобальная обработка ошибок;
* validation pipe;
* JWT guard;
* role guard.

---

## Database

PostgreSQL.

ORM:

Prisma.

---

## Код

Требования:

* модульность;
* DTO;
* сервисы;
* отсутствие бизнес-логики в контроллерах;
* unit tests.

---

# План разработки

## Этап 0. Подготовка (полдня)

Результат:

Рабочий проект.

Сделать:

* Nest CLI;
* Docker Compose;
* PostgreSQL;
* Prisma;
* ESLint;
* Prettier.

---

# Этап 1. Основы Nest (1 день)

Изучить:

* modules;
* controllers;
* providers;
* DI.

Сделать:

```
GET /health
```

Добавить:

* Swagger;
* конфигурацию окружения.

---

# Этап 2. База данных (1 день)

Создать:

* User;
* Campaign;
* Member.

Изучить:

* Prisma schema;
* migrations;
* relations.

---

# Этап 3. Авторизация (2 дня)

Сделать:

* регистрацию;
* логин;
* JWT;
* guard.

Получить:

```
GET /me
```

работает только с токеном.

---

# Этап 4. Кампании и роли (2 дня)

Реализовать:

* создание кампании;
* приглашение пользователей;
* роли.

Изучить:

* Guards;
* custom decorators.

Добавить:

```ts
@RequireRole(MASTER)
```

---

# Этап 5. Игровые системы и персонажи (2 дня)

Сделать:

* GameSystem;
* CharacterTemplate;
* Character.

Загрузить первый шаблон:

```
Tales from the Loop
```

---

# Этап 6. Заметки и доступы (2 дня)

Сделать:

* CRUD заметок;
* visibility;
* фильтрацию.

Ключевой навык:

проверка прав доступа.

---

# Этап 7. Раздатки (1 день)

Сначала:

```
fileUrl
```

Потом:

* загрузка файлов;
* storage.

---

# Этап 8. Мини-фронт (3-4 дня)

React:

Страницы:

```
Login

Campaign list

Campaign page

Characters

Notes

Handouts
```

---

# Этап 9. Качество (2 дня)

Добавить:

## Тесты

* auth;
* permissions;
* campaign.

## Docker

```
app

postgres

nginx
```

---

# После MVP

Вот куда развивать:

## Версия 1

* поиск;
* Markdown editor;
* теги;
* история изменений.

## Версия 2

* Redis;
* background jobs;
* уведомления.

## Версия 3

* WebSocket;
* совместное расследование;
* чат.

## Версия 4

AI помощник мастера:

```
Создай 5 улик для тайны
про исчезнувшего робота
```

---