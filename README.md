# Foodies Backend

The backend API for **Foodies**, a recipe-sharing application. It provides authentication and session management, user profiles and social relationships, recipe discovery and management, favorites, and reference data.

## Features

### Authentication and sessions

- User registration and login.
- JWT access tokens for protected endpoints.
- HTTP-only refresh-token cookies with refresh-token rotation.
- Session validation, refresh, and logout/revocation.
- Password hashing with bcrypt and request validation.

### User profiles and social features

- Retrieve the authenticated user's profile and profile statistics.
- Retrieve another user's profile by ID.
- Update the authenticated user's avatar.
- Follow and unfollow users.
- Retrieve paginated follower and following lists.
- Profile responses expose recipe counts; recipe lists are retrieved through the recipe endpoints.

### Recipes

- Browse and filter the recipe catalog by category, area, ingredient, and owner.
- Retrieve recipe details, including instructions and ingredients.
- Retrieve popular recipes.
- Retrieve the authenticated user's own recipes.
- Create, update, and delete recipes.
- Upload recipe photos and manage stored images through Cloudinary.
- Add recipes to and remove recipes from favorites.
- Retrieve paginated favorite recipes.
- Return `isFavorite` for recipe cards when appropriate.
- Stable pagination and deterministic ordering.

### Reference data

- Recipe categories.
- Areas/cuisines.
- Ingredients.
- User testimonials.

## Tech stack

- **Node.js** and **Express 5**
- **TypeScript**
- **PostgreSQL**
- **Prisma ORM** (7.x) with the PostgreSQL driver adapter
- **JWT** and **bcrypt**
- **Cloudinary** for image storage
- **Zod** for request validation
- **Swagger UI / OpenAPI 3** for API documentation
- **Neon** for hosted PostgreSQL and **Render** for deployment

## API documentation

When the server is running:

- Swagger UI: `http://localhost:<PORT>/docs`
- OpenAPI JSON: `http://localhost:<PORT>/docs/openapi.json`

The OpenAPI specification is stored in [`docs/openapi.json`](docs/openapi.json). Additional API notes are available in [`docs/api.md`](docs/api.md).

## API overview

All routes are mounted at the root path.

| Method   | Endpoint                | Access                        | Description                                       |
| -------- | ----------------------- | ----------------------------- | ------------------------------------------------- |
| `GET`    | `/health`               | Public                        | Health check                                      |
| `POST`   | `/auth/register`        | Public                        | Register a user                                   |
| `POST`   | `/auth/login`           | Public                        | Log in                                            |
| `POST`   | `/auth/refresh`         | Refresh cookie                | Rotate refresh token and issue a new access token |
| `POST`   | `/auth/logout`          | Access token                  | Revoke the current refresh session                |
| `GET`    | `/users/current`        | Access token                  | Get the current user's profile and counts         |
| `GET`    | `/users/:id`            | Access token                  | Get another user's profile and follow status      |
| `PATCH`  | `/users/current/avatar` | Access token                  | Update the current user's avatar                  |
| `GET`    | `/users/:id/followers`  | Access token                  | Get a user's paginated followers                  |
| `GET`    | `/users/following`      | Access token                  | Get the current user's paginated following list   |
| `PUT`    | `/users/:id/follow`     | Access token                  | Follow a user                                     |
| `DELETE` | `/users/:id/follow`     | Access token                  | Unfollow a user                                   |
| `GET`    | `/recipes`              | Public; optional access token | Browse and filter recipes                         |
| `GET`    | `/recipes/popular`      | Public; optional access token | Get up to four popular recipes                    |
| `GET`    | `/recipes/:id`          | Public; optional access token | Get recipe details                                |
| `POST`   | `/recipes`              | Access token                  | Create a recipe                                   |
| `GET`    | `/recipes/own`          | Access token                  | Get the current user's recipes                    |
| `PATCH`  | `/recipes/:id`          | Access token                  | Update a recipe owned by the current user         |
| `DELETE` | `/recipes/:id`          | Access token                  | Delete a recipe owned by the current user         |
| `GET`    | `/recipes/favorites`    | Access token                  | Get the current user's paginated favorites        |
| `PUT`    | `/recipes/:id/favorite` | Access token                  | Add a recipe to favorites                         |
| `DELETE` | `/recipes/:id/favorite` | Access token                  | Remove a recipe from favorites                    |
| `GET`    | `/categories`           | Public                        | List recipe categories                            |
| `GET`    | `/areas`                | Public                        | List cuisine areas                                |
| `GET`    | `/ingredients`          | Public                        | List ingredients                                  |
| `GET`    | `/testimonials`         | Public                        | List testimonials                                 |

All user and recipe IDs are 24-character hexadecimal strings. Consult Swagger for exact request schemas, validation rules, and response examples.

## Authentication

Protected endpoints require an access token in the request header:

```http
Authorization: Bearer <access_token>
```

The access token is returned in the JSON response after registration or login. Refresh tokens are stored in an HTTP-only `refreshToken` cookie and are not intended to be read by frontend JavaScript.

To refresh a session, send a credentialed request to `POST /auth/refresh`; the browser must include the refresh cookie. A successful refresh rotates the refresh token and returns a new access token. The logout endpoint revokes the refresh session and clears the cookie.

For browser clients using cookies, configure Axios or fetch to send credentials and configure `ALLOWED_ORIGINS` with the exact frontend origins.

## Pagination and filtering

Paginated endpoints use `page` and `limit` query parameters. Recipe lists default to `page=1` and `limit=9`; the maximum recipe page size is 100.

A paginated response has this shape:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 9,
    "total": 0,
    "totalPages": 0
  }
}
```

Recipe catalog filters can be combined:

- `category` — category name from `/categories`.
- `area` — area name from `/areas`.
- `ingredientId` — ingredient ID from `/ingredients`.
- `ownerId` — recipe owner's user ID.
- `page` and `limit` — pagination.

Recipe results are ordered by `createdAt DESC`, then `id DESC`. Unknown or repeated query parameters are rejected where the endpoint uses strict query validation. See Swagger and [`docs/api.md`](docs/api.md) for endpoint-specific details.

## Image uploads

Recipe creation and avatar updates use `multipart/form-data`. Recipe creation requires a photo; recipe updates can omit a new photo to keep the existing one. Supported image formats and size limits are validated by the API. Images are stored in Cloudinary.

When sending `FormData` from a browser, do not manually set the `Content-Type` header; the browser must add the multipart boundary.

## Getting started

### Requirements

- Node.js (the project is configured for Node.js 24)
- npm
- PostgreSQL
- Cloudinary credentials for image-upload functionality

### 1. Clone and install

```bash
git clone https://github.com/Your-Natka/foodies-backend.git
cd foodies-backend
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root. Use `.env.example` as the template:

```env
ALLOWED_ORIGINS=http://localhost:5173
PORT=3000

DATABASE_URL=
DIRECT_URL=

TEST_DATABASE_URL=

JWT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

| Variable                | Purpose                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `ALLOWED_ORIGINS`       | Comma-separated, exact frontend origins allowed by CORS                           |
| `PORT`                  | HTTP server port; defaults to `3000` if omitted                                   |
| `DATABASE_URL`          | PostgreSQL connection string used by the application                              |
| `DIRECT_URL`            | Direct PostgreSQL connection string used by Prisma CLI operations when configured |
| `TEST_DATABASE_URL`     | Dedicated PostgreSQL connection used by automated tests                           |
| `JWT_SECRET`            | Secret used to sign and verify JWT access tokens                                  |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name                                                             |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                                                |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                                                             |

Keep secrets out of source control. `TEST_DATABASE_URL` must point to a dedicated test database/server, never production. The automated test setup may create and drop temporary databases, so its PostgreSQL user needs permission to create databases.

### 3. Apply database migrations

Make sure PostgreSQL is running and `DATABASE_URL` / `DIRECT_URL` are configured.

```bash
npx prisma migrate dev
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. (Optional) Seed reference and sample data

```bash
npm run seed
```

### 6. Start the development server

```bash
npm run dev
```

The API runs at `http://localhost:<PORT>` (default `3000`). Open `http://localhost:3000/docs` to use Swagger UI when using the default port.

## Available scripts

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Run the TypeScript server in watch mode using `tsx`  |
| `npm run build`     | Generate Prisma Client and compile TypeScript        |
| `npm start`         | Start the compiled server from `dist/src/server.js`  |
| `npm run typecheck` | Run TypeScript type checking without emitting files  |
| `npm test`          | Run the Node.js test runner against `test/*.test.ts` |
| `npm run seed`      | Seed the database using `prisma/seed.ts`             |

## Tests

Run the automated test suite with:

```bash
npm test
```

Type-check the project with:

```bash
npm run typecheck
```

The tests use `TEST_DATABASE_URL`, a separate PostgreSQL test connection. The test setup is designed to create a temporary database, apply migrations, run tests, and remove the temporary database. Ensure the configured test database user has the required database-creation privileges. Cloudinary behavior is mocked in tests where applicable; tests should not require production image operations.

## Deployment

The repository is configured for deployment with Render and a PostgreSQL database hosted on Neon.

Configure the production environment variables in the hosting platform:

- `DATABASE_URL`
- `DIRECT_URL` (for migration commands)
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PORT` (normally supplied by the hosting platform)

Apply committed Prisma migrations with:

```bash
npx prisma migrate deploy
```

Build and start commands are:

```bash
npm run build
npm start
```

Run migrations as a deployment/pre-deploy step before starting the application. Do not run development migration or database-reset commands against production.

## License

This project is part of the Foodies application.
