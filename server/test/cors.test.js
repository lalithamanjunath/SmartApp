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
