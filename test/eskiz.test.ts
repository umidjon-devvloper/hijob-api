import test from 'node:test';
import assert from 'node:assert/strict';
import { EskizClient } from '../src/sms/eskiz.client';

/** Sprint 7 — Eskiz.uz SMS client. */

const devConfig = { get: () => undefined } as any;
const prodConfig = {
  get: (k: string) => {
    if (k === 'ESKIZ_EMAIL') return 'shop@example.com';
    if (k === 'ESKIZ_PASSWORD') return 's3cret';
    if (k === 'ESKIZ_BASE_URL') return 'https://notify.eskiz.uz/api';
    if (k === 'ESKIZ_FROM') return '4546';
    return undefined;
  },
} as any;

test('dev fallback returns true and does not call fetch', async () => {
  const client = new EskizClient(devConfig);
  const originalFetch = globalThis.fetch;
  let called = false;
  (globalThis as any).fetch = async () => {
    called = true;
    return { ok: true, json: async () => ({}) };
  };
  try {
    const ok = await client.send('+998900001122', 'code: 1234');
    assert.equal(ok, true);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('isConfigured reflects env presence', () => {
  assert.equal(new EskizClient(devConfig).isConfigured(), false);
  assert.equal(new EskizClient(prodConfig).isConfigured(), true);
});

test('prod path logs in, sends, and retries after a 401', async () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const client = new EskizClient(prodConfig);

  let loginCalls = 0;
  let sendCalls = 0;
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init: any) => {
    if (url.endsWith('/auth/login')) {
      loginCalls += 1;
      const body = JSON.parse(init.body);
      assert.equal(body.email, 'shop@example.com');
      assert.equal(body.password, 's3cret');
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { token: `tok_${loginCalls}` } }),
      };
    }
    if (url.endsWith('/message/sms/send')) {
      sendCalls += 1;
      // First send: pretend token is stale.
      if (sendCalls === 1) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      // Second send: succeed.
      return { ok: true, status: 200, json: async () => ({}) };
    }
    throw new Error(`unexpected url ${url}`);
  };
  try {
    const ok = await client.send('+998900001122', 'code: 4321');
    assert.equal(ok, true);
    assert.equal(loginCalls, 2, 'must re-login after 401');
    assert.equal(sendCalls, 2, 'must retry send after 401');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = previousEnv;
  }
});
