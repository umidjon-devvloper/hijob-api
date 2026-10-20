import test from 'node:test';
import assert from 'node:assert/strict';
import { PushService } from '../src/push/push.service';

/** Sprint 7 — Expo Push wrapper. Mocks global fetch. */

function fakePrisma(tokens: Array<{ token: string; userId: string }>) {
  const store = [...tokens];
  const deleted: string[] = [];
  return {
    _tokens: () => store,
    _deleted: () => deleted,
    pushToken: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        store.filter((t) => t.userId === where.userId),
      upsert: async ({ create }: any) => {
        const idx = store.findIndex((t) => t.token === create.token);
        if (idx >= 0) store[idx] = { ...store[idx], ...create };
        else store.push(create);
        return create;
      },
      deleteMany: async ({ where }: { where: { token: { in: string[] } } }) => {
        for (const t of where.token.in) {
          const i = store.findIndex((s) => s.token === t);
          if (i >= 0) {
            store.splice(i, 1);
            deleted.push(t);
          }
        }
        return { count: where.token.in.length };
      },
    },
  };
}

test('sendToUser sends nothing when user has no tokens', async () => {
  const prisma = fakePrisma([]);
  const svc = new PushService(prisma as any);
  const res = await svc.sendToUser('user_1', 'hi', 'body');
  assert.deepEqual(res, { sent: 0 });
});

test('sendToUser posts to Expo and returns sent count', async () => {
  const prisma = fakePrisma([
    { userId: 'user_1', token: 'ExponentPushToken[aaa]' },
    { userId: 'user_1', token: 'ExponentPushToken[bbb]' },
  ]);
  const svc = new PushService(prisma as any);

  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;
  (globalThis as any).fetch = async (_url: string, init: any) => {
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }, { status: 'ok' }] }),
    };
  };
  try {
    const res = await svc.sendToUser('user_1', 'To\'lov', "Buyurtmangiz tasdiqlandi", { orderId: 'o1' });
    assert.equal(res.sent, 2);
    assert.equal(capturedBody.length, 2);
    assert.equal(capturedBody[0].title, "To'lov");
    assert.deepEqual(capturedBody[0].data, { orderId: 'o1' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendToUser prunes DeviceNotRegistered tokens', async () => {
  const prisma = fakePrisma([
    { userId: 'user_1', token: 'ExponentPushToken[good]' },
    { userId: 'user_1', token: 'ExponentPushToken[dead]' },
  ]);
  const svc = new PushService(prisma as any);

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        { status: 'ok' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ],
    }),
  });
  try {
    await svc.sendToUser('user_1', 't', 'b');
    assert.deepEqual(prisma._deleted(), ['ExponentPushToken[dead]']);
    assert.equal(prisma._tokens().length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendToUser tolerates a fetch failure without throwing', async () => {
  const prisma = fakePrisma([{ userId: 'user_1', token: 'ExponentPushToken[x]' }]);
  const svc = new PushService(prisma as any);
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    throw new Error('network down');
  };
  try {
    const res = await svc.sendToUser('user_1', 't', 'b');
    assert.deepEqual(res, { sent: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('registerToken upserts the token for the user', async () => {
  const prisma = fakePrisma([]);
  const svc = new PushService(prisma as any);
  const res = await svc.registerToken('user_1', 'ExponentPushToken[new]', 'ios');
  assert.deepEqual(res, { ok: true });
  assert.equal(prisma._tokens().length, 1);
  assert.equal(prisma._tokens()[0].token, 'ExponentPushToken[new]');
});
