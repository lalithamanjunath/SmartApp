import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.COOKIE_SAME_SITE = 'none';
process.env.COOKIE_SECURE = 'true';
process.env.CLIENT_ORIGIN = 'https://smartapp-s388.vercel.app/, http://localhost:3000/, https://smartapp-s388.vercel.app';

const { env } = await import('../src/config/env.js');
const { app } = await import('../src/app.js');

test('CORS config normalizes the Vercel production origin and local dev origin', () => {
  assert.deepEqual(env.clientOrigins, ['https://smartapp-s388.vercel.app', 'http://localhost:3000']);
});

test('OPTIONS preflight succeeds for the production Vercel origin', async () => {
  const response = await supertest(app)
    .options('/api/v1/auth/login')
    .set('Origin', 'https://smartapp-s388.vercel.app')
    .set('Access-Control-Request-Method', 'POST');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'https://smartapp-s388.vercel.app');
});

test('CSRF token endpoint works without MongoDB and sets a production-safe cookie', async () => {
  const response = await supertest(app).get('/api/v1/auth/csrf');

  assert.equal(response.status, 200);
  assert.match(response.body.data.csrfToken, /^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/);
  assert.match(response.headers['set-cookie'][0], /tandem_csrf=/);
  assert.match(response.headers['set-cookie'][0], /Secure/i);
  assert.match(response.headers['set-cookie'][0], /SameSite=None/i);
  assert.doesNotMatch(response.headers['set-cookie'][0], /HttpOnly/i);
});

test('CSRF endpoint reports invalid JWT configuration as 503 instead of an internal error', async () => {
  const originalSecret = env.jwtSecret;
  const originalExpiry = env.jwtExpiresIn;
  try {
    env.jwtSecret = '';
    let response = await supertest(app).get('/api/v1/auth/csrf');
    assert.equal(response.status, 503);
    assert.match(response.body.message, /JWT_SECRET/);

    env.jwtSecret = originalSecret;
    env.jwtExpiresIn = 'invalid-expiry';
    response = await supertest(app).get('/api/v1/auth/csrf');
    assert.equal(response.status, 503);
    assert.match(response.body.message, /JWT_EXPIRES_IN/);
  } finally {
    env.jwtSecret = originalSecret;
    env.jwtExpiresIn = originalExpiry;
  }
});

test('an unlisted browser origin is rejected with 403 rather than 500', async () => {
  const response = await supertest(app)
    .get('/api/v1/auth/csrf')
    .set('Origin', 'https://unlisted.example');

  assert.equal(response.status, 403);
  assert.equal(response.body.message, 'This origin is not allowed by CORS.');

  const preflight = await supertest(app)
    .options('/api/v1/auth/csrf')
    .set('Origin', 'https://unlisted.example')
    .set('Access-Control-Request-Method', 'GET');
  assert.equal(preflight.status, 403);
});
