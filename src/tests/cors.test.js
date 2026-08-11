import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from '../app.js';

test('permite orígenes de Vercel y dominios sin esquema', () => {
  process.env.NODE_ENV = 'production';
  process.env.CORS_ALLOW_ALL = 'false';
  process.env.CORS_ALLOW_VERCEL_PREVIEWS = 'true';
  process.env.CORS_ALLOWED_ORIGINS = 'https://frontend-demo.vercel.app,https://www.dominio.com';

  assert.equal(isAllowedOrigin('https://frontend-demo.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://www.dominio.com'), true);
  assert.equal(isAllowedOrigin('https://otro.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://malicious.example.com'), false);
});
