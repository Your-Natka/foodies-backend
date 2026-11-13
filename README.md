# Foodies Backend

RESTful API for **Foodies**, a recipe-sharing platform where users can discover recipes, share their own creations, save favorites, and follow other users.

## Overview

Foodies Backend provides the server-side functionality for the Foodies application. It handles user authentication, recipe management, user profiles, social interactions, and reference data.

The API is built with Node.js, Express 5, TypeScript, Prisma ORM, and PostgreSQL.

## Features

### Authentication

- User registration and login.
- JWT-based authentication using access tokens.
- Refresh token rotation.
- HTTP-only cookie for refresh token storage.
- Session validation and revocation.
- Logout functionality.

### Users

- Retrieve the current user's profile.
- View other users' profiles.
- Update the current user's avatar.
- View user recipes and profile statistics.
- Follow and unfollow users.
- Retrieve followers and following lists.

### Recipes

- Browse the recipe catalog.
- Filter recipes by category, area, ingredient, and owner.
- Retrieve recipe details.
- View popular recipes.
- Retrieve recipes created by the current user.
- Create and delete recipes.
- Upload recipe images.
- Add and remove recipes from favorites.
- Retrieve the current user's favorite recipes.
- Paginated recipe lists.

### Reference Data

- Retrieve recipe categories.
- Retrieve areas of origin.
- Retrieve available ingredients.
- Retrieve user testimonials.

## Tech Stack

- **Node.js** — JavaScript runtime.
- **Express 5** — web application framework.
- **TypeScript** — static typing.
- **PostgreSQL** — relational database.
- **Prisma ORM** — database access and schema management.
- **JWT** — authentication.
- **Cloudinary** — image storage and management.
- **Swagger / OpenAPI 3.0** — API documentation.
- **Render** — backend deployment.
- **Neon** — hosted PostgreSQL database.

## API Documentation

Interactive API documentation is available through Swagger UI:

- **Swagger UI:** `/docs`
- **OpenAPI specification:** `/docs/openapi.json`

When running locally, open:

```text
http://localhost:<PORT>/docs
```

The API documentation describes available endpoints, request parameters, authentication requirements, request bodies, and response formats.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- PostgreSQL
- Git

### Installation

Clone the repository:

```bash
git clone <repository-url>
```

Navigate to the project directory:

```bash
cd foodies-backend
```

Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root and configure the environment variables required by the application.

Database configuration:

```env
DATABASE_URL=
DIRECT_URL=
```

### Environment Variables

Create a `.env` file in the project root and configure according to the environment variables listed in `.env.example`:

| Variable                | Description                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOWED_ORIGINS`       | Comma-separated list of frontend origins allowed to access the API.                                                               |
| `PORT`                  | Port used by the application server.                                                                                              |
| `DATABASE_URL`          | PostgreSQL connection URL used by the application.                                                                                |
| `DIRECT_URL`            | Direct PostgreSQL connection URL used for database migrations.                                                                    |
| `TEST_DATABASE_URL`     | Connection URL for the local PostgreSQL instance used by automated tests. The test user must have permission to create databases. |
| `JWT_SECRET`            | Secret key used to sign and verify JWT tokens.                                                                                    |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name.                                                                                                            |
| `CLOUDINARY_API_KEY`    | Cloudinary API key.                                                                                                               |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret.                                                                                                            |

**Notes:**

- `ALLOWED_ORIGINS` should contain the exact frontend origins, separated by commas, without quotes.
- `DATABASE_URL` and `DIRECT_URL` must point to the appropriate PostgreSQL database connections.
- `TEST_DATABASE_URL` must point to a dedicated local PostgreSQL instance for automated testing. It must not point to the production database.

### Database Setup

Make sure your PostgreSQL database is available and the database connection variables are configured.

Apply Prisma migrations:

```bash
npx prisma migrate dev
```

Generate the Prisma Client:

```bash
npx prisma generate
```

### Run Locally

Build the application:

```bash
npm run build
```

Start the server:

```bash
npm start
```

Once the server is running, Swagger UI is available at:

```text
http://localhost:<PORT>/docs
```

## Testing

The project includes automated tests for type checking and API functionality.

### Available Test Commands

Run TypeScript type checking:

```bash
npm run typecheck
```

Run the test suite:

```bash
npm test
```

### Test Database Configuration

Set the `TEST_DATABASE_URL` environment variable to connect to a local PostgreSQL instance.

The PostgreSQL test user must have permission to create databases.

Each test run:

1. Creates a separate database with a randomly generated name.
2. Applies Prisma migrations to the newly created database.
3. Runs the tests against that database.
4. Drops only the temporary test database after the test run finishes.

The main database configured through `DATABASE_URL` is not used by the test suite.

**Important:** Use a dedicated local PostgreSQL instance and a test user with database creation privileges. Never configure `TEST_DATABASE_URL` to point to a production database.

### Test Coverage

The tests cover recipe creation through the HTTP API, including:

- HTTP request handling.
- User authentication and authorization.
- PostgreSQL database operations.
- Recipe creation and related data persistence.
- Image upload error handling.
- Image cleanup behavior.

Cloudinary calls are mocked during testing. This includes simulated responses for upload failures and image cleanup failures, so tests do not require actual Cloudinary operations.

## Available Scripts

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `npm run build`     | Generates Prisma Client and compiles TypeScript. |
| `npm start`         | Starts the compiled application.                 |
| `npm run typecheck` | Runs TypeScript type checking.                   |
| `npm test`          | Runs the automated test suite.                   |

## Authentication

The API uses JWT-based authentication.

- **Access token** is used to authorize protected API requests. It is sent in the `Authorization` header using the Bearer scheme.
- **Refresh token** is stored in an HTTP-only cookie and is used to obtain a new access token.
- Refresh tokens are rotated when a session is successfully refreshed.

Example authorization header:

```http
Authorization: Bearer <access_token>
```

Some endpoints are public, while others require a valid access token. The authentication requirements are described for each endpoint in Swagger UI.

## Deployment

The backend is deployed on **Render** and uses a PostgreSQL database hosted on **Neon**.

Production environment variables must be configured in the hosting provider's environment settings.

The application uses the `PORT` environment variable provided by the hosting platform.

## Project Structure

The project is organized around application source code, database configuration, and API documentation.

```text
foodies-backend/
├── prisma/              # Prisma schema and database migrations
├── src/                 # Application source code
├── dist/                # Compiled application output
├── openapi.json         # OpenAPI specification
├── package.json
├── tsconfig.json
└── README.md
```

## License

This project is part of the Foodies application.
