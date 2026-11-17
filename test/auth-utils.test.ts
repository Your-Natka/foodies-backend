import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";

import { hashPassword, comparePassword } from "../src/utils/hashPassword.ts";

import { hashToken } from "../src/utils/hashToken.ts";

import {
  generateAccessToken,
  generateRefreshToken,
  getJwtSecret,
} from "../src/utils/generateTokens.ts";

const TEST_JWT_SECRET = "test-jwt-secret-for-unit-tests";

process.env.JWT_SECRET = TEST_JWT_SECRET;

//hash password
test("hashPassword returns a hashed password", async () => {
  const password = "StrongPassword123";

  const hashedPassword = await hashPassword(password);

  assert.notEqual(hashedPassword, password);
  assert.ok(hashedPassword.length > 0);
  assert.ok(hashedPassword.startsWith("$2"));
});

test("comparePassword returns true for a correct password", async () => {
  const password = "StrongPassword123";
  const hashedPassword = await hashPassword(password);

  const result = await comparePassword(password, hashedPassword);

  assert.equal(result, true);
});

test("comparePassword returns false for an incorrect password", async () => {
  const password = "StrongPassword123";
  const hashedPassword = await hashPassword(password);

  const result = await comparePassword("WrongPassword123", hashedPassword);

  assert.equal(result, false);
});

// hash token
test("hashToken returns a SHA-256 hash", () => {
  const token = "test-refresh-token";

  const hashedToken = hashToken(token);

  assert.notEqual(hashedToken, token);
  assert.match(hashedToken, /^[a-f0-9]{64}$/);
});

test("hashToken returns the same hash for the same token", () => {
  const token = "test-refresh-token";

  const firstHash = hashToken(token);
  const secondHash = hashToken(token);

  assert.equal(firstHash, secondHash);
});

test("hashToken returns different hashes for different tokens", () => {
  const firstHash = hashToken("first-token");
  const secondHash = hashToken("second-token");

  assert.notEqual(firstHash, secondHash);
});

// generate access token
test("generateAccessToken creates a valid access token", () => {
  const userId = "test-user-id";

  const token = generateAccessToken(userId);
  const decoded = jwt.verify(token, getJwtSecret());

  assert.equal(typeof token, "string");
  assert.equal(typeof decoded, "object");

  if (typeof decoded === "string") {
    assert.fail("JWT payload should be an object");
  }

  assert.equal(decoded.sub, userId);
  assert.equal(decoded.type, "access");
  assert.ok(decoded.jti);
  assert.ok(decoded.iat);
  assert.ok(decoded.exp);
});

test("generateAccessToken creates unique token IDs", () => {
  const firstToken = generateAccessToken("test-user-id");
  const secondToken = generateAccessToken("test-user-id");

  const firstPayload = jwt.verify(firstToken, getJwtSecret()) as jwt.JwtPayload;

  const secondPayload = jwt.verify(
    secondToken,
    getJwtSecret(),
  ) as jwt.JwtPayload;

  assert.notEqual(firstPayload.jti, secondPayload.jti);
});

// generate refresh token
test("generateRefreshToken creates a valid refresh token", () => {
  const userId = "test-user-id";

  const token = generateRefreshToken(userId);
  const decoded = jwt.verify(token, getJwtSecret());

  assert.equal(typeof token, "string");
  assert.equal(typeof decoded, "object");

  if (typeof decoded === "string") {
    assert.fail("JWT payload should be an object");
  }

  assert.equal(decoded.sub, userId);
  assert.equal(decoded.type, "refresh");
  assert.ok(decoded.jti);
  assert.ok(decoded.iat);
  assert.ok(decoded.exp);
});

test("generateRefreshToken creates unique token IDs", () => {
  const firstToken = generateRefreshToken("test-user-id");
  const secondToken = generateRefreshToken("test-user-id");

  const firstPayload = jwt.verify(firstToken, getJwtSecret()) as jwt.JwtPayload;

  const secondPayload = jwt.verify(
    secondToken,
    getJwtSecret(),
  ) as jwt.JwtPayload;

  assert.notEqual(firstPayload.jti, secondPayload.jti);
});

// JWT secret
test("getJwtSecret returns the configured secret", () => {
  assert.equal(getJwtSecret(), TEST_JWT_SECRET);
});
