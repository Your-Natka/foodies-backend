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

`POST /api/recipes` створює рецепт і повертає 201 з його ID та деталями. Потрібні access token, multipart/form-data з фото та поля з [контракту](docs/api.md#post-apirecipes). Для фото заповніть `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` у `.env`. Приймаються JPEG, PNG і WebP до 5 МіБ.

Swagger UI для рецептів і підписок доступний на `/docs/`, схема на `/docs/openapi.json`. У Swagger можна передати access token через Authorize та перевірити запити. Маршрути обраного ще належать до BE-04 і тут не описані як готові.

Після оновлення застосуйте міграції та згенеруйте Prisma Client. Міграція `20261112121718_add_recipe_photo_public_id` додає nullable public ID для видалення завантажених фото; початкові зовнішні фото не змінюються.

## Перевірки

```sh
npm run typecheck
npm test
```

Для тестів задайте `TEST_DATABASE_URL` для локального PostgreSQL. Тестовому користувачу потрібне право створювати бази. Кожен запуск створює окрему базу з випадковою назвою, застосовує міграції та видаляє тільки цю базу після завершення. Основна база з `DATABASE_URL` не використовується.

Тести створення проходять через HTTP, авторизацію та PostgreSQL. Виклики Cloudinary замінені тестовими відповідями, зокрема для помилок завантаження й очищення фото.
