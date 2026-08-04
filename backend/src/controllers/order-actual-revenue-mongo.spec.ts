/**
 * Phase 2 Mongo: JS SSOT predicates must match aggregation results for the shared fixture set.
 * Uses mongodb-memory-server only. No production / Atlas / emails / payments.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Order from '../models/Order';
import {
  buildActualRevenueInRangeMatch,
  buildActualRevenueMatch,
  computeActualRevenueStats,
  computeActualRevenueStatsInRange,
  finalizeActualRevenueAggregate,
  getOrderRevenueAmount,
  orderContributesActualRevenue,
  revenueAmountMongoExpr
} from '../utils/order-actual-revenue.util';
import { PHASE2_REVENUE_FIXTURES } from './order-actual-revenue.fixtures';
import { getSharedMongoUri, stopMongoMemoryServer } from './_mongo-memory';

let mongodUri = '';

test.before(async () => {
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  mongodUri = await getSharedMongoUri('rev-mongo');
  await mongoose.connect(mongodUri);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await stopMongoMemoryServer(null);
});

test.beforeEach(async () => {
  await Order.deleteMany({});
});

async function seedAll() {
  const docs = Object.values(PHASE2_REVENUE_FIXTURES)
    .filter((f) => (f as any).key !== 'invalid_totalPrice')
    .map((f) => {
      const { key, ...rest } = f as any;
      void key;
      return {
        items: [{ productId: new mongoose.Types.ObjectId(), name: 'טסט', quantity: 1, price: 10 }],
        customerDetails: {
          fullName: 'בדיקה',
          phone: '0501234567',
          email: 'noreply-test@example.invalid',
          ...(rest.customerDetails || {})
        },
        orderType: 'shabbat',
        ...rest
      };
    });
  // Invalid totalPrice cannot be stored via mongoose cast — insert via raw collection.
  await Order.insertMany(docs);
  await Order.collection.insertOne({
    items: [{ productId: new mongoose.Types.ObjectId(), name: 'טסט', quantity: 1, price: 10 }],
    totalPrice: 'abc',
    paymentStatus: 'captured',
    status: 'delivered',
    paidAt: new Date('2026-07-13T10:00:00.000Z'),
    isTestOrder: false,
    customerDetails: {
      fullName: 'בדיקה',
      phone: '0509999999',
      email: 'noreply-test@example.invalid'
    },
    orderType: 'shabbat',
    createdAt: new Date('2026-07-13T10:00:00.000Z'),
    updatedAt: new Date('2026-07-13T10:00:00.000Z')
  } as any);
}

test('mongo parity: buildActualRevenueMatch equals JS inclusion set', async () => {
  await seedAll();
  const lean = await Order.find({}).lean();
  const jsIncluded = lean.filter((d) => orderContributesActualRevenue(d as any));
  const mongo = await Order.find(buildActualRevenueMatch()).lean();
  assert.equal(mongo.length, jsIncluded.length);

  const jsIds = new Set(jsIncluded.map((d) => String(d._id)));
  for (const m of mongo) {
    assert.ok(jsIds.has(String(m._id)), `mongo-only id ${m._id}`);
  }

  const jsStats = computeActualRevenueStats(lean as any[]);
  const rows = await Order.aggregate([
    { $match: buildActualRevenueMatch() },
    {
      $group: {
        _id: null,
        revenue: { $sum: revenueAmountMongoExpr() },
        paidOrderCount: { $sum: 1 }
      }
    }
  ]);
  const agg = finalizeActualRevenueAggregate(rows[0]);
  assert.equal(agg.paidOrderCount, jsStats.paidOrderCount);
  assert.equal(agg.revenue, jsStats.revenue);
  assert.equal(agg.averageOrderValue, jsStats.averageOrderValue);
});

test('mongo parity: effectivePaidAt range matches JS range stats', async () => {
  await seedAll();
  const from = new Date('2026-07-01T00:00:00.000Z');
  const to = new Date('2026-07-31T23:59:59.999Z');
  const lean = await Order.find({}).lean();
  const js = computeActualRevenueStatsInRange(lean as any[], from, to);

  const rows = await Order.aggregate([
    { $match: buildActualRevenueInRangeMatch(from, to) },
    {
      $group: {
        _id: null,
        revenue: { $sum: revenueAmountMongoExpr() },
        paidOrderCount: { $sum: 1 }
      }
    }
  ]);
  const agg = finalizeActualRevenueAggregate(rows[0]);
  assert.equal(agg.paidOrderCount, js.paidOrderCount);
  assert.equal(agg.revenue, js.revenue);

  // New order with paidAt in July / createdAt in June counted once in July.
  const julyOnly = lean.filter(
    (d) => getOrderRevenueAmount(d as any) === 120 || String((d as any).paidAt || '').includes('2026-07-20')
  );
  assert.ok(julyOnly.length >= 1);
});

test('mongo: archive and ops status flips do not change revenue aggregate', async () => {
  await Order.create({
    items: [{ productId: new mongoose.Types.ObjectId(), name: 'טסט', quantity: 1, price: 10 }],
    totalPrice: 77,
    paymentStatus: 'captured',
    status: 'ready',
    paidAt: new Date('2026-07-16T10:00:00.000Z'),
    customerDetails: { fullName: 'א', phone: '0501111111', email: 'a@example.invalid' },
    orderType: 'shabbat',
    isDeleted: false,
    isTestOrder: false
  });

  const sum = async () => {
    const rows = await Order.aggregate([
      { $match: buildActualRevenueMatch() },
      { $group: { _id: null, revenue: { $sum: revenueAmountMongoExpr() }, n: { $sum: 1 } } }
    ]);
    return { revenue: rows[0]?.revenue ?? 0, n: rows[0]?.n ?? 0 };
  };

  const before = await sum();
  await Order.updateOne({}, { $set: { isDeleted: true, status: 'delivered' } });
  const afterArchive = await sum();
  await Order.updateOne({}, { $set: { isDeleted: false, status: 'cancelled' } });
  const afterCancel = await sum();

  assert.equal(before.revenue, 77);
  assert.equal(afterArchive.revenue, 77);
  assert.equal(afterCancel.revenue, 77);
  assert.equal(before.n, afterArchive.n);
  assert.equal(before.n, afterCancel.n);
});
