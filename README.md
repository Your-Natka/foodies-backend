# Foodies backend

API застосунку з рецептами на Express, TypeScript, PostgreSQL та Prisma.

## Запуск

Потрібні Node.js 24 і PostgreSQL. Скопіюйте `.env.example` у `.env`, заповніть `DATABASE_URL`, `PORT` та `ALLOWED_ORIGINS` (origins через кому). Створіть базу даних перед застосуванням міграцій.

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

`npm start` запускає сервер без стеження за файлами. `GET /api/health` перевіряє HTTP-сервер.

## API

[Контракт і стан реалізації](docs/api.md). Каталог доступний через `GET /api/recipes`; приклад: `/api/recipes?category=Seafood&page=1&limit=9`.

`GET /api/recipes/:id` повертає рецепт з автором, інструкціями та інгредієнтами. Невірний формат ID повертає 400, відсутній рецепт 404.

`GET /api/recipes/popular` повертає до чотирьох рецептів за кількістю користувачів, які додали їх в обране. Маршрут публічний, без query-параметрів.

`GET /api/recipes/own` повертає свої рецепти з пагінацією `page`/`limit`. `DELETE /api/recipes/:id` видаляє тільки власний рецепт і повертає 204. Для обох маршрутів потрібен `Authorization: Bearer <accessToken>`; у `.env` задайте `JWT_SECRET`, з яким підписуються access-токени. Чужий рецепт видалити не можна, відповідь 403.

## Перевірки

```sh
npm run typecheck
npm test
```

Для тестів задайте `TEST_DATABASE_URL` для локального PostgreSQL. Тестовому користувачу потрібне право створювати бази. Кожен запуск створює окрему базу з випадковою назвою, застосовує міграції та видаляє тільки цю базу після завершення. Основна база з `DATABASE_URL` не використовується.
