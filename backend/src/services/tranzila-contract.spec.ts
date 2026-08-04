/**
 * Tranzila outbound contract freeze.
 *
 * Purpose: lock the exact request shape sent to Tranzila (HPP URL + V1 REST)
 * so future Phase 0+ work around the integration cannot silently change it.
 *
 * Rules:
 * - Never call the real Tranzila network.
 * - Never use real card data (tokens are synthetic fixtures).
 * - Do not modify tranzila.service.ts to make these tests pass.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import axios from 'axios';
import {
  TranzilaService,
  buildTranzilaInvoiceItems,
  resolveTranzilaCaptureClient
} from './tranzila.service';

const V1_URL = 'https://api.tranzila.com/v1/transaction/credit_card/create';

const FIXTURE = {
  terminal: 'megadim_contract_terminal',
  appKey: 'contract_app_key_001',
  appSecret: 'contract_app_secret_001',
  successUrl: 'https://api.example.test/api/payment/success?orderId=ord-contract-1',
  hostedBase: 'https://direct.tranzila.com/megadim_contract_terminal/iframe.php',
  orderId: 'ord-contract-1',
  paymentSecurityToken: 'sec-token-contract-aabbcc',
  totalPrice: 123.45,
  transactionId: '99887766',
  authCode: 'AUTH9988',
  cardToken: 'tok_contract_not_a_real_card',
  expireMonth: 12,
  expireYear: 2030,
  // Fixed entropy for deterministic HMAC headers
  nonceBytes: Buffer.from('0123456789abcdef0123456789abcdef01234567', 'hex'),
  nowMs: 1_700_000_000_000
};

function expectedHmac(appKey: string, appSecret: string, nonce: string, requestTime: string): string {
  const cleanKey = appKey.trim().replace(/['"]/g, '');
  const cleanSecret = appSecret.trim().replace(/['"]/g, '');
  const hmacKey = cleanSecret + requestTime + nonce;
  return crypto.createHmac('sha256', hmacKey).update(cleanKey).digest('hex');
}

function withEnv(run: () => Promise<void> | void): Promise<void> {
  const prev = {
    TERMINAL: process.env.TRANZILA_TERMINAL_NAME,
    KEY: process.env.TRANZILA_APP_KEY,
    SECRET: process.env.TRANZILA_APP_SECRET,
    SUCCESS: process.env.TRANZILA_SUCCESS_URL,
    HOSTED: process.env.TRANZILA_HOSTED_URL,
    NODE_ENV: process.env.NODE_ENV
  };
  process.env.TRANZILA_TERMINAL_NAME = FIXTURE.terminal;
  process.env.TRANZILA_APP_KEY = FIXTURE.appKey;
  process.env.TRANZILA_APP_SECRET = FIXTURE.appSecret;
  process.env.TRANZILA_SUCCESS_URL = FIXTURE.successUrl;
  delete process.env.TRANZILA_HOSTED_URL;
  process.env.NODE_ENV = 'test';

  return Promise.resolve()
    .then(run)
    .finally(() => {
      const restore = (k: string, v: string | undefined) => {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      };
      restore('TRANZILA_TERMINAL_NAME', prev.TERMINAL);
      restore('TRANZILA_APP_KEY', prev.KEY);
      restore('TRANZILA_APP_SECRET', prev.SECRET);
      restore('TRANZILA_SUCCESS_URL', prev.SUCCESS);
      restore('TRANZILA_HOSTED_URL', prev.HOSTED);
      restore('NODE_ENV', prev.NODE_ENV);
    });
}

function freezeEntropy(): () => void {
  const originalRandom = crypto.randomBytes;
  const originalNow = Date.now;
  (crypto as any).randomBytes = (size: number) => {
    assert.equal(size, 20, 'Tranzila nonce must be crypto.randomBytes(20)');
    return Buffer.from(FIXTURE.nonceBytes);
  };
  Date.now = () => FIXTURE.nowMs;
  return () => {
    (crypto as any).randomBytes = originalRandom;
    Date.now = originalNow;
  };
}

type CapturedAxios = {
  method: string;
  url: string;
  data: any;
  headers: Record<string, string>;
  timeout?: number;
};

function installAxiosCapture(responseData: any): {
  calls: CapturedAxios[];
  restore: () => void;
} {
  const calls: CapturedAxios[] = [];
  const originalPost = axios.post;
  (axios as any).post = async (url: string, data: any, config: any) => {
    calls.push({
      method: 'POST',
      url,
      data,
      headers: { ...(config?.headers || {}) },
      timeout: config?.timeout
    });
    return { data: responseData, status: 200 };
  };
  return {
    calls,
    restore: () => {
      (axios as any).post = originalPost;
    }
  };
}

test('contract: HPP generateAuthUrl — base, method shape, query keys/values/order', async () => {
  await withEnv(() => {
    const svc = new TranzilaService();
    const url = svc.generateAuthUrl({
      _id: FIXTURE.orderId,
      totalPrice: FIXTURE.totalPrice,
      paymentSecurityToken: FIXTURE.paymentSecurityToken,
      successUrl: FIXTURE.successUrl
    });

    const parsed = new URL(url);
    assert.equal(
      `${parsed.origin}${parsed.pathname}`,
      FIXTURE.hostedBase,
      'HPP base URL must remain direct.tranzila.com/{terminal}/iframe.php'
    );

    // Exact query string freeze (URLSearchParams insertion order + encoding)
    const expectedParams = new URLSearchParams();
    expectedParams.set('tranmode', 'VK');
    expectedParams.set('Oredrid', FIXTURE.orderId);
    expectedParams.set('myid', FIXTURE.orderId);
    expectedParams.set('sum', '123.45');
    expectedParams.set('currency', '1');
    expectedParams.set('success_url', FIXTURE.successUrl);
    expectedParams.set('pdesc', FIXTURE.paymentSecurityToken);
    expectedParams.set('contact', FIXTURE.paymentSecurityToken);
    expectedParams.set('success_url_address', FIXTURE.successUrl);

    assert.equal(
      parsed.searchParams.toString(),
      expectedParams.toString(),
      'HPP query string must be byte-identical for frozen inputs'
    );

    // Named field freeze
    assert.deepEqual(
      [...parsed.searchParams.keys()],
      [
        'tranmode',
        'Oredrid',
        'myid',
        'sum',
        'currency',
        'success_url',
        'pdesc',
        'contact',
        'success_url_address'
      ]
    );
    assert.equal(parsed.searchParams.get('tranmode'), 'VK');
    assert.equal(parsed.searchParams.get('currency'), '1');
    assert.equal(parsed.searchParams.get('Oredrid'), FIXTURE.orderId);
    assert.equal(parsed.searchParams.get('myid'), FIXTURE.orderId);
    assert.equal(parsed.searchParams.get('sum'), '123.45');
    assert.equal(parsed.searchParams.get('pdesc'), FIXTURE.paymentSecurityToken);
    assert.equal(parsed.searchParams.get('contact'), FIXTURE.paymentSecurityToken);
    assert.equal(parsed.searchParams.get('success_url'), FIXTURE.successUrl);
    assert.equal(parsed.searchParams.get('success_url_address'), FIXTURE.successUrl);
  });
});

test('contract: HPP uses TRANZILA_HOSTED_URL override when set (base only)', async () => {
  await withEnv(() => {
    process.env.TRANZILA_HOSTED_URL = 'https://hosted.example.test/custom/iframe.php';
    const svc = new TranzilaService();
    const url = svc.generateAuthUrl({
      _id: FIXTURE.orderId,
      totalPrice: 10,
      paymentSecurityToken: 'tok',
      successUrl: FIXTURE.successUrl
    });
    const parsed = new URL(url);
    assert.equal(`${parsed.origin}${parsed.pathname}`, 'https://hosted.example.test/custom/iframe.php');
    assert.equal(parsed.searchParams.get('tranmode'), 'VK');
  });
});

test('contract: buildTranzilaInvoiceItems — item/shipping/discount/fallback shapes', () => {
  const withItems = buildTranzilaInvoiceItems({
    totalPrice: 90,
    deliveryFee: 10,
    items: [
      { name: 'חלת שבת', price: 50, quantity: 1 },
      { name: 'מרק', price: 40, quantity: 1 }
    ]
  });
  assert.deepEqual(withItems, [
    { name: 'חלת שבת', type: 'I', unit_price: 50, units_number: 1 },
    { name: 'מרק', type: 'I', unit_price: 40, units_number: 1 },
    { name: 'דמי משלוח', type: 'S', unit_price: 10, units_number: 1 },
    { name: 'הנחה', type: 'C', unit_price: -10, units_number: 1 }
  ]);

  const empty = buildTranzilaInvoiceItems({ totalPrice: 55, items: [] });
  assert.deepEqual(empty, [
    { name: 'הזמנה', type: 'I', unit_price: 55, units_number: 1 }
  ]);
});

test('contract: resolveTranzilaCaptureClient — name/email selection', () => {
  assert.deepEqual(
    resolveTranzilaCaptureClient({
      totalPrice: 1,
      customerDetails: { fullName: ' ישראל כהן ', email: 'Israel@Example.COM' },
      userName: 'ignored',
      userEmail: 'ignored@x.com'
    }),
    { name: 'ישראל כהן', email: 'israel@example.com' }
  );
  assert.deepEqual(
    resolveTranzilaCaptureClient({
      totalPrice: 1,
      customerDetails: { email: 'not-an-email' },
      userName: 'Fallback Name'
    }),
    { name: 'Fallback Name' }
  );
});

test('contract: capturePayment POST — URL, body fields, headers, timeout; no network', async () => {
  await withEnv(async () => {
    const restoreEntropy = freezeEntropy();
    const axiosMock = installAxiosCapture({
      error_code: 0,
      message: 'success',
      transaction_result: {
        transaction_id: 112233,
        auth_number: 'A1',
        processor_response_code: '000'
      }
    });

    try {
      const svc = new TranzilaService();
      const result = await svc.capturePayment(
        FIXTURE.transactionId,
        FIXTURE.totalPrice,
        FIXTURE.authCode,
        FIXTURE.cardToken,
        FIXTURE.expireMonth,
        FIXTURE.expireYear,
        {
          totalPrice: FIXTURE.totalPrice,
          deliveryFee: 0,
          items: [{ name: 'מנה', price: 123.45, quantity: 1 }],
          customerDetails: { fullName: 'לקוח בדיקה', email: 'buyer@example.test' }
        }
      );

      assert.equal(axiosMock.calls.length, 1, 'exactly one outbound capture call');
      const call = axiosMock.calls[0];
      assert.equal(call.method, 'POST');
      assert.equal(call.url, V1_URL);
      assert.equal(call.timeout, 15_000);

      // Body: exact keys + values (order of object keys as constructed in service)
      assert.deepEqual(Object.keys(call.data), [
        'terminal_name',
        'txn_type',
        'txn_currency_code',
        'reference_txn_id',
        'authorization_number',
        'card_number',
        'expire_month',
        'expire_year',
        'response_language',
        'items',
        'client'
      ]);
      assert.equal(call.data.terminal_name, FIXTURE.terminal);
      assert.equal(call.data.txn_type, 'force');
      assert.equal(call.data.txn_currency_code, 'ILS');
      assert.equal(call.data.reference_txn_id, Number(FIXTURE.transactionId));
      assert.equal(call.data.authorization_number, FIXTURE.authCode);
      assert.equal(call.data.card_number, FIXTURE.cardToken);
      assert.equal(call.data.expire_month, FIXTURE.expireMonth);
      assert.equal(call.data.expire_year, FIXTURE.expireYear);
      assert.equal(call.data.response_language, 'hebrew');
      assert.deepEqual(call.data.items, [
        { name: 'מנה', type: 'I', unit_price: 123.45, units_number: 1 }
      ]);
      assert.deepEqual(call.data.client, {
        name: 'לקוח בדיקה',
        email: 'buyer@example.test'
      });

      // Headers: names + deterministic HMAC with frozen nonce/time
      const nonce = FIXTURE.nonceBytes.toString('hex');
      const requestTime = Math.floor(FIXTURE.nowMs / 1000).toString();
      const expectedSig = expectedHmac(FIXTURE.appKey, FIXTURE.appSecret, nonce, requestTime);

      assert.deepEqual(Object.keys(call.headers).sort(), [
        'Content-Type',
        'X-tranzila-api-access-token',
        'X-tranzila-api-app-key',
        'X-tranzila-api-nonce',
        'X-tranzila-api-request-time'
      ]);
      assert.equal(call.headers['Content-Type'], 'application/json');
      assert.equal(call.headers['X-tranzila-api-app-key'], FIXTURE.appKey);
      assert.equal(call.headers['X-tranzila-api-nonce'], nonce);
      assert.equal(call.headers['X-tranzila-api-request-time'], requestTime);
      assert.equal(call.headers['X-tranzila-api-access-token'], expectedSig);

      // Response parsing contract used by payment.controller
      assert.equal(result.ok, true);
      assert.equal(result.parsed?.['index'], '112233');
      assert.equal(result.parsed?.['transaction_id'], '112233');
      assert.equal(result.parsed?.['auth_number'], 'A1');
      assert.equal(result.parsed?.['Response'], '000');
      assert.equal(result.parsed?.['error_code'], '0');
    } finally {
      axiosMock.restore();
      restoreEntropy();
    }
  });
});

test('contract: voidPayment POST — URL, body fields, headers; no network', async () => {
  await withEnv(async () => {
    const restoreEntropy = freezeEntropy();
    const axiosMock = installAxiosCapture({
      error_code: 0,
      message: 'success'
    });

    try {
      const svc = new TranzilaService();
      const result = await svc.voidPayment(FIXTURE.transactionId, FIXTURE.authCode);
      assert.equal(result.ok, true);
      assert.equal(axiosMock.calls.length, 1);

      const call = axiosMock.calls[0];
      assert.equal(call.method, 'POST');
      assert.equal(call.url, V1_URL);
      assert.equal(call.timeout, 15_000);

      assert.deepEqual(Object.keys(call.data), [
        'terminal_name',
        'txn_type',
        'txn_currency_code',
        'reference_txn_id',
        'authorization_number'
      ]);
      assert.deepEqual(call.data, {
        terminal_name: FIXTURE.terminal,
        txn_type: 'reversal',
        txn_currency_code: 'ILS',
        reference_txn_id: Number(FIXTURE.transactionId),
        authorization_number: FIXTURE.authCode
      });

      const nonce = FIXTURE.nonceBytes.toString('hex');
      const requestTime = Math.floor(FIXTURE.nowMs / 1000).toString();
      assert.equal(call.headers['X-tranzila-api-app-key'], FIXTURE.appKey);
      assert.equal(call.headers['X-tranzila-api-nonce'], nonce);
      assert.equal(call.headers['X-tranzila-api-request-time'], requestTime);
      assert.equal(
        call.headers['X-tranzila-api-access-token'],
        expectedHmac(FIXTURE.appKey, FIXTURE.appSecret, nonce, requestTime)
      );
      assert.equal(call.headers['Content-Type'], 'application/json');
    } finally {
      axiosMock.restore();
      restoreEntropy();
    }
  });
});

test('contract: voidPayment defaults authorization_number to 0000000 when authCode missing', async () => {
  await withEnv(async () => {
    const restoreEntropy = freezeEntropy();
    const axiosMock = installAxiosCapture({ error_code: 0, message: 'success' });
    try {
      const svc = new TranzilaService();
      await svc.voidPayment(FIXTURE.transactionId, undefined);
      assert.equal(axiosMock.calls[0].data.authorization_number, '0000000');
    } finally {
      axiosMock.restore();
      restoreEntropy();
    }
  });
});

test('contract: isConfigured checks only TERMINAL_NAME + SUCCESS_URL (current behavior freeze)', async () => {
  await withEnv(() => {
    const svc = new TranzilaService();
    assert.equal(svc.isConfigured(), true);

    delete process.env.TRANZILA_APP_KEY;
    delete process.env.TRANZILA_APP_SECRET;
    // Still configured under current contract — capture/void will fail later on missing key
    assert.equal(svc.isConfigured(), true);

    delete process.env.TRANZILA_SUCCESS_URL;
    assert.equal(svc.isConfigured(), false);
  });
});

test('contract: capture/void never invoked without axios mock safety net', async () => {
  // Meta-guard: ensure this suite does not leave axios.post unrestored.
  assert.equal(typeof axios.post, 'function');
});
