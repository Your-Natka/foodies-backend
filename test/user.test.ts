import "dotenv/config";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-jwt-secret-for-automated-tests";

const { default: app } = await import("../src/app.ts");
const { default: prisma } = await import("../prisma/client.ts");

const { generateAccessToken } = await import("../src/utils/generateTokens.ts");
const { generateId } = await import("../src/utils/generateId.ts");

const USERS_PATH = "/users";

const testUsers: string[] = [];

const createTestUser = async (name: string, email: string) => {
  const user = await prisma.user.create({
    data: {
      id: generateId(),
      name,
      email,
      password: "test-password-hash",
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  });

  testUsers.push(user.id);

  return user;
};

const getAuthHeader = (userId: string) => ({
  Authorization: `Bearer ${generateAccessToken(userId)}`,
});

let currentUser: Awaited<ReturnType<typeof createTestUser>>;
let anotherUser: Awaited<ReturnType<typeof createTestUser>>;

before(async () => {
  const result = await prisma.$queryRaw<
    { database: string }[]
  >`SELECT current_database() AS database`;

  assert.equal(
    result[0]?.database,
    "foodies_test",
    "Tests must run against foodies_test database",
  );
});

beforeEach(async () => {
  currentUser = await createTestUser(
    "Test Current User",
    `current-${generateId()}@example.com`,
  );

  anotherUser = await createTestUser(
    "Test Another User",
    `another-${generateId()}@example.com`,
  );
});

after(async () => {
  if (testUsers.length > 0) {
    await prisma.user.deleteMany({
      where: {
        id: { in: testUsers },
      },
    });
  }

  await prisma.$disconnect();
});

// GET CURRENT USER

test("GET /users/current should return current user's profile", async () => {
  const response = await request(app)
    .get(`${USERS_PATH}/current`)
    .set(getAuthHeader(currentUser.id));

  assert.equal(response.status, 200);

  assert.deepEqual(response.body, {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    avatar: null,
    recipesCount: 0,
    favoritesCount: 0,
    followersCount: 0,
    followingCount: 0,
    recipes: [],
  });
});

test("GET /users/current should return 401 without access token", async () => {
  const response = await request(app).get(`${USERS_PATH}/current`);

  assert.equal(response.status, 401);
});

// GET USER BY ID

test("GET /users/:id should return another user's public profile", async () => {
  const response = await request(app)
    .get(`${USERS_PATH}/${anotherUser.id}`)
    .set(getAuthHeader(currentUser.id));

  assert.equal(response.status, 200);

  assert.deepEqual(response.body, {
    id: anotherUser.id,
    name: anotherUser.name,
    email: anotherUser.email,
    avatar: null,
    recipesCount: 0,
    followersCount: 0,
    isFollowing: false,
    recipes: [],
  });

  assert.equal(response.headers["cache-control"], "private, no-store");
});

test("GET /users/:id should return 404 for non-existent user", async () => {
  const response = await request(app)
    .get(`${USERS_PATH}/non-existent-user-id`)
    .set(getAuthHeader(currentUser.id));

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: "User not found",
  });
});

test("GET /users/:id should return 401 without access token", async () => {
  const response = await request(app).get(`${USERS_PATH}/${anotherUser.id}`);

  assert.equal(response.status, 401);
});

// UPDATE CURRENT USER AVATAR

test("PATCH /users/current/avatar should return 400 when avatar file is missing", async () => {
  const response = await request(app)
    .patch(`${USERS_PATH}/current/avatar`)
    .set(getAuthHeader(currentUser.id));

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "Avatar file is required",
  });
});

test("PATCH /users/current/avatar should return 401 without access token", async () => {
  const response = await request(app).patch(`${USERS_PATH}/current/avatar`);

  assert.equal(response.status, 401);
});
