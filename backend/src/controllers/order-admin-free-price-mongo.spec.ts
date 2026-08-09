/**
 * #4/#10 integration: admin line price (incl. free 0₪) updates final total
 * and charge amount (totalPrice) on unlocked / authorized orders.
 * Uses mongodb-memory-server only — never Atlas / production.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Order from '../models/Order';
import MenuItem from '../models/menuItem';
import { OrderService } from '../services/order.service';
import { getSharedMongoUri, stopMongoMemoryServer } from './_mongo-memory';

const service = new OrderService();

async function seedCatalogProduct(price = 45) {
  return MenuItem.create({
    name: 'חומוס טסט מחיר',
    category: 'סלטים',
    price,
    pricingOptions: [{ label: '250 מ"ל', price, amount: '250' }],
    tags: [],
    isAvailable: true,
    isPopular: false,
    isFeatured: false
  });
}

async function seedOrder(opts: {
  productId: string;
  unitPrice: number;
  qty: number;
  paymentStatus: string;
  authorizedAmount?: number | null;
  deliveryFee?: number;
}) {
  const lineTotal = opts.unitPrice * opts.qty;
  const deliveryFee = opts.deliveryFee ?? 0;
  const totalPrice = lineTotal + deliveryFee;
  return Order.create({
    items: [
      {
        productId: opts.productId,
        name: 'חומוס טסט מחיר (250 מ"ל - 250)',
        quantity: opts.qty,
        price: opts.unitPrice,
        category: 'סלטים',
        priceSource: 'catalog',
        selectedOption: { label: '250 מ"ל', amount: '250', price: opts.unitPrice, optionId: '0' }
      }
    ],
    subtotal: lineTotal,
    deliveryFee,
    totalPrice,
    paymentStatus: opts.paymentStatus,
    authorizedAmount: opts.authorizedAmount ?? null,
    status: 'processing',
    orderType: 'shabbat',
    orderNumber: `MG-TEST-FREE-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    customerDetails: {
      fullName: 'בדיקת מחיר חינם',
      phone: '0500000099',
      email: 'noreply-free-price-test@example.invalid',
      eventDate: '2099-06-01',
      deliveryMethod: 'pickup'
    }
  });
}

test.before(async () => {
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  const uri = await getSharedMongoUri('admin-free-price');
  await mongoose.connect(uri);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await stopMongoMemoryServer(null);
});

test.beforeEach(async () => {
  await Order.deleteMany({});
  await MenuItem.deleteMany({});
});

test('awaiting_payment: set line free (0) + discount — totalPrice/subtotal update for charge', async () => {
  const product = await seedCatalogProduct(45);
  const productId = String(product._id);
  const order = await seedOrder({
    productId,
    unitPrice: 45,
    qty: 2,
    paymentStatus: 'awaiting_payment',
    deliveryFee: 10
  });
  assert.equal(order.totalPrice, 100); // 90 + 10

  const updated = await service.updateOrderItems(String(order._id), [
    {
      productId,
      name: 'חומוס טסט מחיר (250 מ"ל - 250)',
      quantity: 2,
      category: 'סלטים',
      price: 0,
      priceSource: 'admin',
      selectedOption: { label: '250 מ"ל', amount: '250', price: 0, optionId: '0' }
    }
  ]);

  assert.ok(updated);
  assert.equal(updated!.items[0].price, 0);
  assert.equal(String((updated!.items[0] as any).priceSource), 'admin');
  assert.equal(updated!.subtotal, 0);
  assert.equal(updated!.deliveryFee, 10);
  // Charge amount shown in admin = totalPrice
  assert.equal(updated!.totalPrice, 10);

  // Catalog must not overwrite free price on a second notes-less edit with admin flag
  const again = await service.updateOrderItems(String(order._id), [
    {
      productId,
      name: 'חומוס טסט מחיר (250 מ"ל - 250)',
      quantity: 2,
      category: 'סלטים',
      price: 0,
      priceSource: 'admin',
      selectedOption: { label: '250 מ"ל', amount: '250', price: 0, optionId: '0' }
    }
  ]);
  assert.equal(again!.items[0].price, 0);
  assert.equal(again!.totalPrice, 10);
});

test('awaiting_payment: lower unit price below catalog — totalPrice follows new line total', async () => {
  const product = await seedCatalogProduct(45);
  const productId = String(product._id);
  const order = await seedOrder({
    productId,
    unitPrice: 45,
    qty: 2,
    paymentStatus: 'awaiting_payment',
    deliveryFee: 0
  });

  const updated = await service.updateOrderItems(String(order._id), [
    {
      productId,
      name: 'חומוס טסט מחיר (250 מ"ל - 250)',
      quantity: 2,
      category: 'סלטים',
      price: 20,
      priceSource: 'admin',
      selectedOption: { label: '250 מ"ל', amount: '250', price: 20, optionId: '0' }
    }
  ]);

  assert.ok(updated);
  assert.equal(updated!.items[0].price, 20);
  assert.equal(String((updated!.items[0] as any).priceSource), 'admin');
  assert.equal(updated!.subtotal, 40);
  assert.equal(updated!.totalPrice, 40);
});

test('authorized: admin free/discount updates totalPrice (סכום לחיוב); authorizedAmount stays hold snapshot', async () => {
  const product = await seedCatalogProduct(45);
  const productId = String(product._id);
  const order = await seedOrder({
    productId,
    unitPrice: 45,
    qty: 2,
    paymentStatus: 'authorized',
    authorizedAmount: 90,
    deliveryFee: 0
  });
  assert.equal(order.totalPrice, 90);
  assert.equal(order.authorizedAmount, 90);

  const updated = await service.updateOrderItems(String(order._id), [
    {
      productId,
      name: 'חומוס טסט מחיר (250 מ"ל - 250)',
      quantity: 2,
      category: 'סלטים',
      price: 0,
      priceSource: 'admin',
      selectedOption: { label: '250 מ"ל', amount: '250', price: 0, optionId: '0' }
    }
  ]);

  assert.ok(updated);
  assert.equal(updated!.paymentStatus, 'authorized');
  assert.equal(updated!.items[0].price, 0);
  assert.equal(String((updated!.items[0] as any).priceSource), 'admin');
  // Capture button uses totalPrice
  assert.equal(updated!.totalPrice, 0);
  assert.equal(updated!.subtotal, 0);
  // Original hold snapshot must not be rewritten by item edits
  assert.equal(updated!.authorizedAmount, 90);
});

test('captured: totals stay locked even if admin sends free price', async () => {
  const product = await seedCatalogProduct(45);
  const productId = String(product._id);
  const order = await seedOrder({
    productId,
    unitPrice: 45,
    qty: 2,
    paymentStatus: 'captured',
    deliveryFee: 0
  });

  const updated = await service.updateOrderItems(String(order._id), [
    {
      productId,
      name: 'חומוס טסט מחיר (250 מ"ל - 250)',
      quantity: 2,
      category: 'סלטים',
      price: 0,
      priceSource: 'admin',
      selectedOption: { label: '250 מ"ל', amount: '250', price: 0, optionId: '0' }
    }
  ]);

  assert.ok(updated);
  // Line may store admin 0 for kitchen/display, but charge total stays locked
  assert.equal(updated!.items[0].price, 0);
  assert.equal(updated!.totalPrice, 90);
});

test('without priceSource=admin, catalog price wins over client-sent 0', async () => {
  const product = await seedCatalogProduct(45);
  const productId = String(product._id);
  const order = await seedOrder({
    productId,
    unitPrice: 45,
    qty: 1,
    paymentStatus: 'awaiting_payment'
  });

  const updated = await service.updateOrderItems(String(order._id), [
    {
      productId,
      name: 'חומוס טסט מחיר (250 מ"ל - 250)',
      quantity: 1,
      category: 'סלטים',
      price: 0,
      priceSource: 'catalog',
      selectedOption: { label: '250 מ"ל', amount: '250', price: 0, optionId: '0' }
    }
  ]);

  assert.ok(updated);
  assert.equal(updated!.items[0].price, 45);
  assert.equal(updated!.totalPrice, 45);
});
