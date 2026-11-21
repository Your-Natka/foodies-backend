import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import request from "supertest";
import type { Response } from "supertest";
import {
  loginLimiter,
  registerLimiter,
} from "../src/middlewares/rateLimitMiddleware.ts";

// set test environment before importing app and Prisma
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-jwt-secret-for-automated-tests";

const { default: app } = await import("../src/app.ts");
const { default: prisma } = await import("../prisma/client.ts");

const createdEmails: string[] = [];

const createTestUser = () => {
  const email = `test-${randomUUID()}@example.com`;

  createdEmails.push(email);

  return {
    name: "Test User",
    email,
    password: "StrongPassword123",
  };
};

// normalize the set-cookie header to an array
const getCookies = (response: Response): string[] => {
  const cookies = response.headers["set-cookie"];

  if (!cookies) {
    return [];
  }

  return Array.isArray(cookies) ? cookies : [cookies];
};

const registerUser = async () => {
  const user = createTestUser();

  const response = await request(app).post("/auth/register").send(user);

  assert.equal(response.status, 201);

  return { user, response };
};

before(async () => {
  const result = await prisma.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;

  assert.equal(
    result[0]?.current_database,
    "foodies_test",
    "Tests must run against the foodies_test database",
  );
});

beforeEach(async () => {
  await registerLimiter.resetKey("127.0.0.1");
  await loginLimiter.resetKey("127.0.0.1");
});

after(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: createdEmails,
        },
      },
    });
  }

  await prisma.$disconnect();
});

// REGISTER

test("register a new user successfully", async () => {
  const user = createTestUser();

  const response = await request(app).post("/auth/register").send(user);

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  assert.equal(response.body.user.name, user.name);
  assert.equal(response.body.user.email, user.email);

  assert.ok(response.body.user.id);
  assert.ok(response.body.user.createdAt);
  assert.ok(response.body.accessToken);

  assert.equal(response.body.user.password, undefined);

  const cookies = getCookies(response);

  assert.ok(
    cookies.some((cookie) => cookie.includes("refreshToken=")),
    "Refresh token cookie should be set",
  );

  assert.ok(
    cookies.some((cookie) => cookie.toLowerCase().includes("httponly")),
    "Refresh token cookie should be HTTP-only",
  );

  const savedUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  assert.ok(savedUser);
  assert.notEqual(savedUser.password, user.password);
  assert.ok(savedUser.refreshTokenHash);
  assert.ok(savedUser.sessionExpiresAt);
});

test("do not register a user with an existing email", async () => {
  const user = createTestUser();

  const firstResponse = await request(app).post("/auth/register").send(user);

  assert.equal(firstResponse.status, 201);

  const secondResponse = await request(app).post("/auth/register").send(user);

  assert.equal(secondResponse.status, 409);
  assert.equal(secondResponse.body.success, false);
  assert.equal(
    secondResponse.body.message,
    "An account with this email already exists.",
  );
});

test("do not register a user with invalid data", async () => {
  const response = await request(app).post("/auth/register").send({
    name: "A",
    email: "invalid-email",
    password: "123",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Validation failed");
  assert.ok(Array.isArray(response.body.details));
});

// LOGIN

test("log in a user with valid credentials", async () => {
  const { user } = await registerUser();

  const response = await request(app).post("/auth/login").send({
    email: user.email,
    password: user.password,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  assert.equal(response.body.user.email, user.email);
  assert.ok(response.body.accessToken);
  assert.equal(response.body.user.password, undefined);

  const cookies = getCookies(response);

  assert.ok(
    cookies.some((cookie) => cookie.includes("refreshToken=")),
    "Refresh token cookie should be set",
  );
});

test("do not log in with an incorrect password", async () => {
  const { user } = await registerUser();

  const response = await request(app).post("/auth/login").send({
    email: user.email,
    password: "WrongPassword123",
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Invalid email or password.");
});

test("do not log in a user that does not exist", async () => {
  const response = await request(app)
    .post("/auth/login")
    .send({
      email: `missing-${randomUUID()}@example.com`,
      password: "StrongPassword123",
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Invalid email or password.");
});

// LOGOUT

test("log out an authenticated user successfully", async () => {
  const { response: registerResponse } = await registerUser();

  const userId = registerResponse.body.user.id;
  const accessToken = registerResponse.body.accessToken;

  const logoutResponse = await request(app)
    .post("/auth/logout")
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(logoutResponse.status, 204);

  const savedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      refreshTokenHash: true,
      sessionExpiresAt: true,
    },
  });

  assert.ok(savedUser);
  assert.equal(savedUser.refreshTokenHash, null);
  assert.equal(savedUser.sessionExpiresAt, null);

  const cookies = getCookies(logoutResponse);

  assert.ok(
    cookies.some((cookie) => cookie.includes("refreshToken=")),
    "Refresh token cookie should be cleared",
  );
});
