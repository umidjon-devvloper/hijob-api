import test from 'node:test';
import assert from 'node:assert/strict';
import { OrdersService } from '../src/orders/orders.service';

/** Sprint 7 — orderTimeline() renders the correct 5-step story. */

function getTimeline(status: string, deliveryType: string) {
  const svc = new OrdersService({} as any);
  // Reach into the private method — tests need not fake a whole prisma call chain.
  return (svc as any).orderTimeline(status, deliveryType) as Array<{
    key: string;
    label: string;
    reached: boolean;
    active: boolean;
  }>;
}

test('delivery timeline: pending → only "placed" is active', () => {
  const t = getTimeline('pending', 'delivery');
  assert.equal(t.length, 5);
  assert.equal(t[0].key, 'placed');
  assert.equal(t[0].active, true);
  assert.equal(t[0].reached, true);
  assert.equal(t[4].reached, false);
});

test('delivery timeline: shipped → shipped is the active step', () => {
  const t = getTimeline('shipped', 'delivery');
  const shipped = t.find((s) => s.key === 'shipped')!;
  assert.equal(shipped.active, true);
  assert.equal(shipped.reached, true);
  const delivered = t.find((s) => s.key === 'delivered')!;
  assert.equal(delivered.reached, false);
});

test('delivery timeline: delivered → every step reached', () => {
  const t = getTimeline('delivered', 'delivery');
  assert.ok(t.every((s) => s.reached));
  assert.equal(t.find((s) => s.key === 'delivered')?.active, true);
});

test('pickup uses a "ready" milestone instead of "shipped"', () => {
  const t = getTimeline('shipped', 'pickup');
  assert.ok(t.some((s) => s.key === 'ready'));
  assert.ok(!t.some((s) => s.key === 'shipped'));
});

test('proba uses a "proba" milestone', () => {
  const t = getTimeline('proba_scheduled', 'proba');
  const proba = t.find((s) => s.key === 'proba')!;
  assert.equal(proba.reached, true);
  assert.equal(proba.active, true);
});

test('cancelled → nothing past "placed" is reached', () => {
  const t = getTimeline('cancelled', 'delivery');
  // rank = -1, so idx <= -1 is never true → no step reached
  assert.ok(!t.some((s) => s.reached));
});
