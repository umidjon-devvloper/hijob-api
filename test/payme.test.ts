import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymeService } from '../src/payment/payme/payme.service';
import { PaymeErrorCode } from '../src/payment/payme/payme.errors';

/**
 * Sprint 7 — Payme JSON-RPC method coverage.
 * We stub Prisma and PushService in-process so we don't need a DB.
 */

type FakeOrder = {
  id: string;
  userId: string;
  totalUsd: number;
  paymentTxId: string | null;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  orderStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeOrder(overrides: Partial<FakeOrder> = {}): FakeOrder {
  const now = new Date('2026-09-30T12:00:00Z');
  return {
    id: 'order_abcdef',
    userId: 'user_1',
    totalUsd: 10,
    paymentTxId: null,
    paymentStatus: 'pending',
    orderStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fakePrisma(initial: FakeOrder | null) {
  let current = initial ? { ...initial } : null;
  return {
    _get: () => current,
    order: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        current && current.id === where.id ? current : null,
      findFirst: async ({ where }: { where: { paymentTxId?: string } }) =>
        current && current.paymentTxId === where.paymentTxId ? current : null,
      update: async ({ data }: { data: Partial<FakeOrder> }) => {
        current = { ...(current as FakeOrder), ...data, updatedAt: new Date('2026-09-30T12:05:00Z') };
        return current;
      },
    },
  };
}

function fakePush() {
  const sent: Array<{ userId: string; title: string; body: string; data?: any }> = [];
  return {
    _sent: sent,
    sendToUser: async (userId: string, title: string, body: string, data?: any) => {
      sent.push({ userId, title, body, data });
      return { sent: 1 };
    },
    registerToken: async () => ({ ok: true }),
  };
}

const config = {
  get: (key: string) => (key === 'PAYME_KEY' ? 'test-merchant-key' : key === 'USD_UZS_RATE' ? 12800 : undefined),
} as any;

test('verifyAuth accepts valid Basic Paycom:key', () => {
  const svc = new PaymeService({} as any, config, {} as any);
  const encoded = Buffer.from('Paycom:test-merchant-key').toString('base64');
  assert.equal(svc.verifyAuth(`Basic ${encoded}`), true);
});

test('verifyAuth rejects wrong key', () => {
  const svc = new PaymeService({} as any, config, {} as any);
  const encoded = Buffer.from('Paycom:wrong').toString('base64');
  assert.equal(svc.verifyAuth(`Basic ${encoded}`), false);
});

test('verifyAuth rejects missing / malformed header', () => {
  const svc = new PaymeService({} as any, config, {} as any);
  assert.equal(svc.verifyAuth(undefined), false);
  assert.equal(svc.verifyAuth('Bearer xyz'), false);
});

test('CheckPerformTransaction returns allow when amount matches', async () => {
  const prisma = fakePrisma(makeOrder({ totalUsd: 10 }));
  const svc = new PaymeService(prisma as any, config, fakePush() as any);
  const expected = Math.round(10 * 12800 * 100); // 12,800,000 tiyin
  const res = await svc.checkPerformTransaction({ amount: expected, account: { order_id: 'order_abcdef' } });
  assert.deepEqual(res, { allow: true });
});

test('CheckPerformTransaction returns InvalidAmount on mismatch', async () => {
  const prisma = fakePrisma(makeOrder({ totalUsd: 10 }));
  const svc = new PaymeService(prisma as any, config, fakePush() as any);
  const res = await svc.checkPerformTransaction({ amount: 42, account: { order_id: 'order_abcdef' } });
  assert.ok('error' in res && res.error.code === PaymeErrorCode.AmountMismatch);
});

test('CheckPerformTransaction returns OrderNotFound for missing order', async () => {
  const prisma = fakePrisma(null);
  const svc = new PaymeService(prisma as any, config, fakePush() as any);
  const res = await svc.checkPerformTransaction({ amount: 1, account: { order_id: 'nope' } });
  assert.ok('error' in res && res.error.code === PaymeErrorCode.OrderNotFound);
});

test('CreateTransaction is idempotent for same txId', async () => {
  const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_1', paymentStatus: 'pending' }));
  const svc = new PaymeService(prisma as any, config, fakePush() as any);
  const res = await svc.createTransaction({
    id: 'tx_1',
    time: Date.now(),
    amount: 10 * 12800 * 100,
    account: { order_id: 'order_abcdef' },
  });
  assert.ok('result' in res);
  assert.equal(res.result?.transaction, 'tx_1');
  assert.equal(res.result?.state, 1);
});

test('CreateTransaction rejects a second competing tx', async () => {
  const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_first' }));
  const svc = new PaymeService(prisma as any, config, fakePush() as any);
  const res = await svc.createTransaction({
    id: 'tx_second',
    time: Date.now(),
    amount: 10 * 12800 * 100,
    account: { order_id: 'order_abcdef' },
  });
  assert.ok('error' in res);
  assert.equal(res.error?.code, PaymeErrorCode.InvalidAccount);
});

test('CreateTransaction attaches txId on happy path', async () => {
  const prisma = fakePrisma(makeOrder());
  const svc = new PaymeService(prisma as any, config, fakePush() as any);
  const res = await svc.createTransaction({
    id: 'tx_new',
    time: 1_700_000_000_000,
    amount: 10 * 12800 * 100,
    account: { order_id: 'order_abcdef' },
  });
  assert.ok('result' in res);
  assert.equal(res.result?.state, 1);
  assert.equal(prisma._get()?.paymentTxId, 'tx_new');
});

test('PerformTransaction marks paid + fires push notification', async () => {
  const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_new', paymentStatus: 'pending' }));
  const push = fakePush();
  const svc = new PaymeService(prisma as any, config, push as any);
  const res = await svc.performTransaction({ id: 'tx_new' });
  assert.ok('result' in res);
  assert.equal(res.result?.state, 2);
  assert.equal(prisma._get()?.paymentStatus, 'paid');
  assert.equal(prisma._get()?.orderStatus, 'confirmed');
  // Push is fire-and-forget; give the microtask a tick.
  await new Promise((r) => setImmediate(r));
  assert.equal(push._sent.length, 1);
  assert.equal(push._sent[0].data?.event, 'payment.paid');
});

test('PerformTransaction is idempotent when already paid', async () => {
  const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_new', paymentStatus: 'paid', orderStatus: 'confirmed' }));
  const push = fakePush();
  const svc = new PaymeService(prisma as any, config, push as any);
  const res = await svc.performTransaction({ id: 'tx_new' });
  assert.ok('result' in res);
  assert.equal(res.result?.state, 2);
  // No new push
  await new Promise((r) => setImmediate(r));
  assert.equal(push._sent.length, 0);
});

test('CancelTransaction: state -1 for unpaid, -2 for paid', async () => {
  {
    const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_a', paymentStatus: 'pending' }));
    const svc = new PaymeService(prisma as any, config, fakePush() as any);
    const res = await svc.cancelTransaction({ id: 'tx_a' });
    assert.ok('result' in res);
    assert.equal(res.result?.state, -1);
    assert.equal(prisma._get()?.paymentStatus, 'failed');
  }
  {
    const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_b', paymentStatus: 'paid' }));
    const svc = new PaymeService(prisma as any, config, fakePush() as any);
    const res = await svc.cancelTransaction({ id: 'tx_b' });
    assert.ok('result' in res);
    assert.equal(res.result?.state, -2);
    assert.equal(prisma._get()?.paymentStatus, 'refunded');
  }
});

test('CheckTransaction returns the right state for each status', async () => {
  const cases: Array<[FakeOrder['paymentStatus'], number]> = [
    ['pending', 1],
    ['paid', 2],
    ['refunded', -2],
    ['failed', -1],
  ];
  for (const [status, expectedState] of cases) {
    const prisma = fakePrisma(makeOrder({ paymentTxId: 'tx_c', paymentStatus: status }));
    const svc = new PaymeService(prisma as any, config, fakePush() as any);
    const res = await svc.checkTransaction({ id: 'tx_c' });
    assert.ok('result' in res);
    assert.equal(res.result?.state, expectedState, `status=${status}`);
  }
});
