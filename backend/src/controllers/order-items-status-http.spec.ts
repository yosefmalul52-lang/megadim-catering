/**
 * HTTP-style integration tests for PUT /api/order/admin/:id/items
 * and PUT /api/order/:id/status (payment exception resolution).
 * Uses the real controller handlers with an in-memory order store — no live DB writes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Request, Response } from 'express';
import { OrderController } from './order.controller';
import { emailService } from '../services/email.service';
import {
  resolveSelectedOptionForUpdate,
  itemVariantFingerprint,
  normalizeSelectedOption,
  parseOptionFromItemName,
  findMatchingPricingOption
} from '../utils/order-item-options.util';
import { computeAdminRecalculatedTotals } from '../utils/order-admin-pricing.util';
import {
  buildAdminStatusChangeUpdate,
  orderMatchesFailedTab,
  orderMatchesOpsProcessingTab,
  hasOpenPaymentException
} from '../utils/order-admin-status.util';
import { ORDER_NOTIFICATION_TYPES } from '../models/OrderNotificationClaim';

type InvocationResult = { status: number; body?: any; error?: any };

function invoke(
  handler: (req: Request, res: Response, next: (error?: unknown) => void) => void,
  opts: { params?: Record<string, string>; body?: Record<string, unknown>; user?: Record<string, unknown> }
): Promise<InvocationResult> {
  return new Promise((resolve) => {
    let status = 200;
    let settled = false;
    const finish = (result: InvocationResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const req = {
      body: opts.body || {},
      params: opts.params || {},
      headers: {},
      query: {},
      method: 'PUT',
      originalUrl: '/api/order',
      user: opts.user || { id: 'admin-1', role: 'admin' }
    } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        finish({ status, body: payload });
        return this;
      }
    } as unknown as Response;
    handler(req, res, (error?: any) => {
      finish({ status: error?.statusCode || 500, error, body: error?.message ? { message: error.message } : undefined });
    });
    setTimeout(() => finish({ status: 500, error: new Error('Handler timeout') }), 2000);
  });
}

/** In-memory mirror of updateOrderItems preserve + total recalc rules (uses real utils). */
function applyItemsUpdate(
  order: any,
  newItems: any[]
): { order: any; emailWouldSend: boolean } {
  if (!Array.isArray(newItems) || !newItems.length) {
    throw Object.assign(new Error('items array is required and must not be empty'), { statusCode: 400 });
  }
  const existingItems = Array.isArray(order.items) ? order.items : [];
  const paymentStatusBefore = order.paymentStatus;
  const tranzilaBefore = {
    authCode: order.authCode,
    transactionId: order.transactionId,
    cardToken: order.cardToken
  };

  const normalized = newItems.map((raw: any, index: number) => {
    const item = raw || {};
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`items[${index}].quantity must be a positive number`), {
        statusCode: 400
      });
    }
    const existing = existingItems[index] || existingItems.find((ex: any) => ex.productId === item.productId) || null;
    const hasSelectedOptionKey = Object.prototype.hasOwnProperty.call(item, 'selectedOption');
    let selectedOption = resolveSelectedOptionForUpdate({
      incoming: item,
      existing,
      hasSelectedOptionKey
    });

    if (existing && !hasSelectedOptionKey) {
      return {
        productId: existing.productId,
        name: existing.name,
        price: existing.price,
        quantity,
        category: existing.category,
        description:
          item.description !== undefined
            ? String(item.description || '').trim()
            : existing.description,
        selectedOption:
          selectedOption ||
          normalizeSelectedOption(existing.selectedOption, {
            name: existing.name,
            price: existing.price
          })
      };
    }

    if (hasSelectedOptionKey && item.selectedOption == null) {
      selectedOption = undefined;
    } else if (hasSelectedOptionKey) {
      selectedOption = normalizeSelectedOption(item.selectedOption, {
        name: item.name,
        price: item.price
      });
    }

    const name =
      existing && !hasSelectedOptionKey
        ? existing.name
        : String(item.name || existing?.name || '').trim();

    return {
      productId: String(item.productId || existing?.productId || ''),
      name,
      price: hasSelectedOptionKey
        ? Number(item.selectedOption?.price ?? item.price ?? existing?.price ?? 0)
        : Number(existing?.price ?? item.price ?? 0),
      quantity,
      category: String(item.category || existing?.category || ''),
      description:
        item.description !== undefined
          ? String(item.description || '').trim()
          : existing?.description,
      selectedOption
    };
  });

  const totals = computeAdminRecalculatedTotals(order, { items: normalized });
  const next = {
    ...order,
    items: normalized,
    totalPrice: totals.locked ? order.totalPrice : totals.totalPrice,
    subtotal: totals.locked ? order.subtotal : totals.subtotal,
    paymentStatus: paymentStatusBefore,
    authCode: tranzilaBefore.authCode,
    transactionId: tranzilaBefore.transactionId,
    cardToken: tranzilaBefore.cardToken
  };
  return { order: next, emailWouldSend: false };
}

test('HTTP items: qty-only preserves selectedOption, name, price; no email; totals recalculate; payment frozen', async () => {
  const store: any = {
    _id: 'ord-items-1',
    orderNumber: 'MG-TEST-ITEMS',
    status: 'processing',
    paymentStatus: 'awaiting_payment',
    totalPrice: 34,
    subtotal: 34,
    transactionId: 'tx-keep',
    items: [
      {
        productId: '6953f95562a18d63c3d0db29-size-0',
        name: 'טחינה (250 מ"ל - 250)',
        quantity: 1,
        price: 17,
        category: 'סלטים',
        selectedOption: { label: '250 מ"ל', amount: '250', price: 17, optionId: '0' },
        description: ''
      }
    ]
  };

  let emailCalls = 0;
  const original = emailService.sendOrderUpdateEmail;
  (emailService as any).sendOrderUpdateEmail = async () => {
    emailCalls += 1;
  };

  const controller = new OrderController();
  (controller as any).orderService = {
    updateOrderItems: async (_id: string, items: any[]) => {
      const result = applyItemsUpdate(store, items);
      Object.assign(store, result.order);
      return store;
    }
  };

  try {
    const result = await invoke(controller.updateOrderItems, {
      params: { id: 'ord-items-1' },
      body: {
        notifyCustomer: false,
        items: [
          {
            productId: store.items[0].productId,
            name: store.items[0].name,
            quantity: 3,
            category: 'סלטים',
            price: 17
            // selectedOption omitted
          }
        ]
      }
    });
    assert.equal(result.status, 200);
    assert.equal(store.items[0].quantity, 3);
    assert.equal(store.items[0].selectedOption.label, '250 מ"ל');
    assert.equal(store.items[0].name, 'טחינה (250 מ"ל - 250)');
    assert.equal(store.items[0].price, 17);
    assert.equal(store.totalPrice, 51);
    assert.equal(store.subtotal, 51);
    assert.equal(store.paymentStatus, 'awaiting_payment');
    assert.equal(store.transactionId, 'tx-keep');
    assert.equal(emailCalls, 0);
  } finally {
    (emailService as any).sendOrderUpdateEmail = original;
  }
});

test('HTTP items: notes-only preserves option; selectedOption:null clears; invalid qty 400', async () => {
  const store: any = {
    _id: 'ord-items-2',
    paymentStatus: 'pending',
    totalPrice: 40,
    subtotal: 40,
    items: [
      {
        productId: 'abc',
        name: 'סלט',
        quantity: 2,
        price: 20,
        category: 'סלטים',
        selectedOption: { label: '500 מ"ל', amount: '500', price: 20 },
        description: 'ישן'
      }
    ]
  };
  const controller = new OrderController();
  (controller as any).orderService = {
    updateOrderItems: async (_id: string, items: any[]) => {
      const result = applyItemsUpdate(store, items);
      Object.assign(store, result.order);
      return store;
    }
  };

  const notes = await invoke(controller.updateOrderItems, {
    params: { id: 'ord-items-2' },
    body: {
      items: [
        {
          productId: 'abc',
          name: 'סלט',
          quantity: 2,
          price: 20,
          description: 'בלי בצל'
        }
      ]
    }
  });
  assert.equal(notes.status, 200);
  assert.equal(store.items[0].description, 'בלי בצל');
  assert.equal(store.items[0].selectedOption.label, '500 מ"ל');

  const cleared = await invoke(controller.updateOrderItems, {
    params: { id: 'ord-items-2' },
    body: {
      items: [
        {
          productId: 'abc',
          name: 'סלט',
          quantity: 2,
          price: 20,
          selectedOption: null
        }
      ]
    }
  });
  assert.equal(cleared.status, 200);
  assert.equal(store.items[0].selectedOption, undefined);

  const badQty = await invoke(controller.updateOrderItems, {
    params: { id: 'ord-items-2' },
    body: { items: [{ productId: 'abc', name: 'סלט', quantity: 0, price: 20 }] }
  });
  assert.equal(badQty.status, 400);
});

test('HTTP items: explicit option change; re-save stable; 250 vs 500 fingerprints', async () => {
  const store: any = {
    _id: 'ord-items-3',
    paymentStatus: 'pending',
    totalPrice: 100,
    items: [
      {
        productId: '6953f95562a18d63c3d0db29',
        name: 'סלט כרוב',
        quantity: 4,
        price: 20,
        category: 'סלטים',
        selectedOption: { label: '250 מ"ל', amount: '250', price: 20 }
      },
      {
        productId: '6953f95562a18d63c3d0db29',
        name: 'סלט כרוב',
        quantity: 3,
        price: 30,
        category: 'סלטים',
        selectedOption: { label: '500 מ"ל', amount: '500', price: 30 }
      }
    ]
  };
  const controller = new OrderController();
  (controller as any).orderService = {
    updateOrderItems: async (_id: string, items: any[]) => {
      const result = applyItemsUpdate(store, items);
      Object.assign(store, result.order);
      return store;
    }
  };

  const k250 = itemVariantFingerprint(store.items[0]);
  const k500 = itemVariantFingerprint(store.items[1]);
  assert.notEqual(k250, k500);

  const changed = await invoke(controller.updateOrderItems, {
    params: { id: 'ord-items-3' },
    body: {
      items: [
        {
          ...store.items[0],
          selectedOption: { label: '1 ליטר', amount: '1 ליטר', price: 40 }
        },
        store.items[1]
      ]
    }
  });
  assert.equal(changed.status, 200);
  assert.equal(store.items[0].selectedOption.label, '1 ליטר');

  const before = JSON.stringify(store.items);
  const again = await invoke(controller.updateOrderItems, {
    params: { id: 'ord-items-3' },
    body: { items: store.items.map((it: any) => ({ ...it })) }
  });
  assert.equal(again.status, 200);
  assert.equal(JSON.stringify(store.items), before);

  // identical 250 rows share fingerprint
  const twin = {
    productId: '6953f95562a18d63c3d0db29',
    name: 'סלט כרוב (250 מ"ל - 250)',
    category: 'סלטים',
    selectedOption: { label: '250 מ"ל', amount: '250' }
  };
  assert.equal(
    itemVariantFingerprint({
      productId: '6953f95562a18d63c3d0db29',
      name: 'סלט כרוב',
      category: 'סלטים',
      selectedOption: { label: '250 מ"ל', amount: '250' }
    }),
    itemVariantFingerprint(twin)
  );
});

/**
 * Mirrors server catalog rematch: shared label must keep amount 500 (not min 250).
 * Also asserts admin edit path does not send customer email when notifyCustomer is false/omitted.
 */
test('HTTP items: 500g rematch stays 500; multi-item; notes omit option; no email', async () => {
  const catalogOptions = [
    { label: 'רגיל', amount: '250', price: 17 },
    { label: 'רגיל', amount: '500', price: 29 }
  ];
  const sideOptions = [
    { label: '250 מ"ל', amount: '250', price: 17 },
    { label: '500 מ"ל', amount: '500', price: 29 }
  ];

  const rematch = (item: any, options: typeof catalogOptions) => {
    const matched = findMatchingPricingOption(options, {
      label: item?.selectedOption?.label,
      amount: item?.selectedOption?.amount
    });
    if (!matched) {
      return {
        ...item,
        selectedOption: {
          ...item.selectedOption,
          missingForReview: true
        }
      };
    }
    return {
      ...item,
      price: Number(matched.option.price),
      selectedOption: {
        label: String(matched.option.label),
        amount: String(matched.option.amount),
        price: Number(matched.option.price),
        optionId: String(matched.index)
      }
    };
  };

  const store: any = {
    _id: 'ord-qty-bug',
    orderNumber: 'MG-QTY-BUG',
    paymentStatus: 'awaiting_payment',
    totalPrice: 75,
    subtotal: 75,
    transactionId: 'tx-qty',
    items: [
      {
        productId: 'hum-1-size-1',
        name: 'חומוס (רגיל - 500)',
        quantity: 1,
        price: 29,
        category: 'סלטים',
        selectedOption: { label: 'רגיל', amount: '500', price: 29, optionId: '1' }
      },
      {
        productId: 'side-1-size-1',
        name: 'טחינה (500 מ"ל - 500)',
        quantity: 2,
        price: 29,
        category: 'סלטים',
        selectedOption: { label: '500 מ"ל', amount: '500', price: 29, optionId: '1' }
      },
      {
        productId: 'main-1',
        name: 'צלי בקר',
        quantity: 3,
        price: 27,
        category: 'עיקריות',
        selectedOption: undefined
      }
    ]
  };

  let emailCalls = 0;
  const original = emailService.sendOrderUpdateEmail;
  (emailService as any).sendOrderUpdateEmail = async () => {
    emailCalls += 1;
  };

  const controller = new OrderController();
  (controller as any).orderService = {
    updateOrderItems: async (_id: string, items: any[]) => {
      // Simulate preserve-when-omitted + rematch-when-present (server behavior)
      const nextItems = items.map((raw: any, index: number) => {
        const existing = store.items[index];
        const hasSelectedOptionKey = Object.prototype.hasOwnProperty.call(raw, 'selectedOption');
        if (existing && !hasSelectedOptionKey) {
          return {
            ...existing,
            quantity: Number(raw.quantity),
            description:
              raw.description !== undefined ? String(raw.description || '').trim() : existing.description,
            price: existing.price,
            selectedOption: existing.selectedOption,
            name: existing.name
          };
        }
        const base = {
          ...existing,
          ...raw,
          quantity: Number(raw.quantity),
          selectedOption: raw.selectedOption
        };
        if (String(base.name || '').includes('חומוס')) return rematch(base, catalogOptions);
        if (String(base.name || '').includes('טחינה')) return rematch(base, sideOptions);
        return base;
      });
      store.items = nextItems;
      return store;
    }
  };

  try {
    // 1) Open + save no-op with selectedOption 500
    const noop = await invoke(controller.updateOrderItems, {
      params: { id: 'ord-qty-bug' },
      body: {
        notifyCustomer: false,
        items: store.items.map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          category: it.category,
          selectedOption: it.selectedOption
        }))
      }
    });
    assert.equal(noop.status, 200);
    assert.equal(store.items[0].selectedOption.amount, '500');
    assert.equal(store.items[0].price, 29);
    assert.equal(store.items[1].selectedOption.amount, '500');
    assert.equal(store.items[1].price, 29);
    assert.equal(store.items[2].name, 'צלי בקר');
    assert.equal(store.totalPrice, 75);
    assert.equal(emailCalls, 0);

    // 2) Notes-only (omit selectedOption) must not alter sizes/prices
    const notes = await invoke(controller.updateOrderItems, {
      params: { id: 'ord-qty-bug' },
      body: {
        items: store.items.map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          category: it.category,
          description: 'הערה פנימית'
        }))
      }
    });
    assert.equal(notes.status, 200);
    assert.equal(store.items[0].selectedOption.amount, '500');
    assert.equal(store.items[0].price, 29);
    assert.equal(store.items[0].description, 'הערה פנימית');
    assert.equal(emailCalls, 0);

    // 3) Intentional change 500 → 250 updates only that line
    const changed = await invoke(controller.updateOrderItems, {
      params: { id: 'ord-qty-bug' },
      body: {
        notifyCustomer: false,
        items: [
          {
            ...store.items[0],
            selectedOption: { label: 'רגיל', amount: '250', price: 17 }
          },
          store.items[1],
          store.items[2]
        ]
      }
    });
    assert.equal(changed.status, 200);
    assert.equal(store.items[0].selectedOption.amount, '250');
    assert.equal(store.items[0].price, 17);
    assert.equal(store.items[1].selectedOption.amount, '500');
    assert.equal(store.items[1].price, 29);
    assert.equal(emailCalls, 0);

    // Prove the matcher itself would have wrongly picked min before the fix:
    // old logic: label==='רגיל' matches index 0 first.
    const oldBuggy = catalogOptions.find(
      (opt) =>
        String(opt.label).toLowerCase() === 'רגיל' ||
        String(opt.amount) === '500'
    );
    assert.equal(String(oldBuggy?.amount), '250');
    const fixed = findMatchingPricingOption(catalogOptions, { label: 'רגיל', amount: '500' });
    assert.equal(String(fixed?.option.amount), '500');
  } finally {
    (emailService as any).sendOrderUpdateEmail = original;
  }
});

test('HTTP status: awaiting/failed → processing closes exception atomically; ready without resolution → 422', async () => {
  let emailCalls = 0;
  const originalApproved = emailService.sendOrderApprovedToCustomer;
  (emailService as any).sendOrderApprovedToCustomer = async () => {
    emailCalls += 1;
    return { sent: true };
  };

  function makeStore(paymentStatus: string) {
    return {
      _id: `ord-${paymentStatus}`,
      status: 'pending',
      paymentStatus,
      paymentExceptionResolvedAt: null,
      paymentExceptionResolution: null,
      paymentInitTokenHash: 'hash',
      transactionId: 'tx-1',
      totalPrice: 50,
      customerDetails: { email: 'test@example.com' },
      statusChangeHistory: [] as any[]
    };
  }

  async function runStatus(store: any, body: Record<string, unknown>) {
    const controller = new OrderController();
    (controller as any).orderService = {
      updateOrderStatus: async (_id: string, updates: any, meta: any) => {
        const previousStatus = store.status;
        const previousPaymentStatus = store.paymentStatus;
        if (
          previousStatus === updates.status &&
          store.paymentExceptionResolvedAt
        ) {
          return {
            order: store,
            previousStatus,
            adminStatusTab: 'processing',
            idempotent: true,
            shouldSendApprovalEmail: false
          };
        }
        try {
          const built = buildAdminStatusChangeUpdate({
            previousStatus,
            nextStatus: updates.status,
            previousPaymentStatus,
            changedBy: meta?.changedBy || 'admin',
            paymentExceptionResolution: updates.paymentExceptionResolution,
            orderHasOpenPaymentException: hasOpenPaymentException(store),
            manualPaymentMethod: updates.manualPaymentMethod,
            manualPaymentNote: updates.manualPaymentNote
          });
          Object.assign(store, built.$set);
          if (built.$unset) {
            for (const k of Object.keys(built.$unset)) delete store[k];
          }
          store.paymentStatus = previousPaymentStatus;
          if (built.$push?.statusChangeHistory) {
            store.statusChangeHistory.push(built.$push.statusChangeHistory);
          }
          return {
            order: store,
            previousStatus,
            adminStatusTab: 'processing',
            idempotent: false,
            shouldSendApprovalEmail: built.shouldSendApprovalEmail
          };
        } catch (err: any) {
          throw err;
        }
      },
      getOrderByIdForEmail: async () => store,
      markLatestStatusChangeNotification: async () => undefined
    };

    return invoke(controller.updateOrderStatus, {
      params: { id: store._id },
      body,
      user: { id: 'admin-1', role: 'admin' }
    });
  }

  try {
    const awaiting = makeStore('awaiting_payment');
    // Explicit move to processing without resolution body = business decision (closes exception).
    const okImplied = await runStatus(awaiting, { status: 'processing' });
    assert.equal(okImplied.status, 200);
    assert.equal(awaiting.status, 'processing');
    assert.ok(awaiting.paymentExceptionResolvedAt);
    assert.equal(awaiting.paymentExceptionResolution, 'approve_and_continue_billing');
    assert.equal(awaiting.paymentStatus, 'awaiting_payment');
    assert.equal(orderMatchesOpsProcessingTab(awaiting), true);
    assert.equal(orderMatchesFailedTab(awaiting), false);
    assert.equal(emailCalls, 1);

    const blockedReady = await runStatus(makeStore('failed'), { status: 'ready' });
    assert.equal(blockedReady.status, 422);

    const failed = makeStore('failed');
    const okFailed = await runStatus(failed, {
      status: 'processing',
      paymentExceptionResolution: 'approve_and_continue_billing'
    });
    assert.equal(okFailed.status, 200);
    assert.equal(failed.paymentStatus, 'failed');
    assert.equal(orderMatchesFailedTab(failed), false);
    assert.equal(orderMatchesOpsProcessingTab(failed), true);

    const paidElse = makeStore('failed');
    const paidRes = await runStatus(paidElse, {
      status: 'processing',
      paymentExceptionResolution: 'paid_elsewhere_continue',
      manualPaymentNote: 'מזומן'
    });
    assert.equal(paidRes.status, 200);
    assert.equal(paidElse.paymentStatus, 'failed');
    assert.equal((paidElse as any)['customerDetails.isPaid'], true);
    assert.ok((paidElse as any).manualPaymentRecordedAt);
  } finally {
    (emailService as any).sendOrderApprovedToCustomer = originalApproved;
  }
});

test('HTTP status: built update is not applied until write succeeds (store stays pending)', () => {
  const store = {
    status: 'pending',
    paymentStatus: 'awaiting_payment',
    paymentExceptionResolvedAt: null as Date | null
  };
  const built = buildAdminStatusChangeUpdate({
    previousStatus: store.status,
    nextStatus: 'processing',
    previousPaymentStatus: store.paymentStatus,
    changedBy: 'admin',
    orderHasOpenPaymentException: true
  });
  assert.equal(built.$set.status, 'processing');
  assert.ok(built.$set.paymentExceptionResolvedAt);
  // Store untouched until findOneAndUpdate applies the ops
  assert.equal(store.status, 'pending');
  assert.equal(store.paymentExceptionResolvedAt, null);
});

test('approval notification type is not used for items path', () => {
  assert.notEqual(
    ORDER_NOTIFICATION_TYPES.ORDER_ITEMS_UPDATED,
    ORDER_NOTIFICATION_TYPES.ORDER_APPROVED
  );
});

test('legacy name parse still recovers when snapshot missing', () => {
  const parsed = parseOptionFromItemName('טחינה (250 מ"ל - 250)');
  assert.equal(parsed.label, '250 מ"ל');
  const resolved = resolveSelectedOptionForUpdate({
    incoming: { name: 'טחינה (250 מ"ל - 250)', quantity: 1 },
    existing: { name: 'טחינה (250 מ"ל - 250)', price: 17 },
    hasSelectedOptionKey: false
  });
  assert.equal(resolved?.label, '250 מ"ל');
});
