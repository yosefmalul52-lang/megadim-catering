/**
 * tranzila.service.ts
 *
 * Tranzila (Israeli payment provider) adapter — V1 REST API.
 *
 * Required ENV vars:
 *   TRANZILA_TERMINAL_NAME  – terminal name (e.g. megadim1)
 *   TRANZILA_APP_KEY        – public application key (from Tranzila portal)
 *   TRANZILA_APP_SECRET     – private application secret (from Tranzila portal)
 *   TRANZILA_HOSTED_URL     – (optional) HPP base URL
 *                             defaults to https://direct.tranzila.com/{terminal}/iframe.php
 *   TRANZILA_SUCCESS_URL    – backend URL Tranzila redirects the browser to after payment
 *                             e.g. https://api.megadim-catering.com/api/payment/success
 *
 * NOTE: TRANZILA_CAPTURE_URL and TRANZILA_CAPTURE_PASSWORD are obsolete (old CGI API).
 * The V1 API uses HMAC-SHA256 headers for authentication instead of a plain password.
 */
import crypto from 'crypto';
import axios from 'axios';

const TRANZILA_V1_URL = 'https://api.tranzila.com/v1/transaction/credit_card/create';

export type TranzilaCaptureResult = {
  ok: boolean;
  raw: string;
  parsed?: Record<string, string>;
};

export type TranzilaInvoiceItem = {
  name: string;
  type: 'I' | 'S' | 'C';
  unit_price: number;
  units_number: number;
};

export type TranzilaCaptureOrderContext = {
  items?: Array<{ name?: string; price?: number; quantity?: number }>;
  totalPrice: number;
  deliveryFee?: number | null;
  subtotal?: number | null;
  customerDetails?: { fullName?: string; email?: string; deliveryFee?: number; subtotal?: number };
  userName?: string;
  userEmail?: string;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Build itemized invoice lines for Tranzila V1 capture.
 * Maps legacy cname{i}/cprice{i}/cqty{i} CGI fields to V1 `items[]`.
 */
export function buildTranzilaInvoiceItems(order: TranzilaCaptureOrderContext): TranzilaInvoiceItem[] {
  const lines: TranzilaInvoiceItem[] = [];

  for (const item of order.items || []) {
    const name = String(item.name || 'פריט').trim() || 'פריט';
    const unitPrice = roundMoney(item.price);
    const units = Math.max(1, Math.round(Number(item.quantity) || 1));
    lines.push({ name, type: 'I', unit_price: unitPrice, units_number: units });
  }

  const cd = order.customerDetails || {};
  const shippingCost = roundMoney(
    order.deliveryFee ?? cd.deliveryFee ?? 0
  );
  if (shippingCost > 0) {
    lines.push({
      name: 'דמי משלוח',
      type: 'S',
      unit_price: shippingCost,
      units_number: 1
    });
  }

  const lineTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.unit_price * line.units_number, 0)
  );
  const targetTotal = roundMoney(order.totalPrice);
  const discountAmount = roundMoney(Math.max(0, lineTotal - targetTotal));

  if (discountAmount > 0) {
    lines.push({
      name: 'הנחה',
      type: 'C',
      unit_price: -discountAmount,
      units_number: 1
    });
  }

  if (lines.length === 0) {
    lines.push({
      name: 'הזמנה',
      type: 'I',
      unit_price: targetTotal,
      units_number: 1
    });
  }

  return lines;
}

/** Resolve customer name/email for Tranzila invoice (client block + root email). */
export function resolveTranzilaCaptureClient(
  order: TranzilaCaptureOrderContext
): { name?: string; email?: string } {
  const cd = order.customerDetails || {};
  const name = String(cd.fullName || order.userName || '').trim();
  const rawEmail = String(cd.email || order.userEmail || '').trim().toLowerCase();
  const email = rawEmail.includes('@') ? rawEmail : '';
  const client: { name?: string; email?: string } = {};
  if (name) client.name = name;
  if (email) client.email = email;
  return client;
}

/**
 * Legacy CGI-style cname/cprice/cqty map (application/x-www-form-urlencoded).
 * V1 REST capture uses `items[]` JSON instead; kept for parity with Tranzila docs.
 */
export function buildTranzilaFormEncodedInvoiceFields(
  order: TranzilaCaptureOrderContext
): Record<string, string> {
  const fields: Record<string, string> = {};
  buildTranzilaInvoiceItems(order).forEach((line, index) => {
    const i = index + 1;
    fields[`cname${i}`] = line.name;
    fields[`cprice${i}`] = String(line.unit_price);
    fields[`cqty${i}`] = String(line.units_number);
  });
  return fields;
}

// ─── Auth Header Helper ───────────────────────────────────────────────────────

/**
 * Generates the 4 HMAC-signed headers required by the Tranzila V1 REST API.
 *
 * Signature formula (per Tranzila docs):
 *   HMAC-SHA256(key = APP_SECRET, data = APP_KEY + request_time + nonce)
 *
 * - nonce:        40-character hex string (crypto.randomBytes(20).toString('hex'))
 * - request_time: Unix timestamp in SECONDS (Math.floor(Date.now() / 1000))
 */
function generateTranzilaHeaders(appKey: string, appSecret: string): Record<string, string> {
  // Aggressively clean both values — strip whitespace, quotes, or hidden chars
  const cleanKey    = appKey.trim().replace(/['"]/g, '');
  const cleanSecret = appSecret.trim().replace(/['"]/g, '');

  const nonce       = crypto.randomBytes(20).toString('hex'); // 40-character hex string
  const requestTime = Math.floor(Date.now() / 1000).toString(); // Unix seconds (not ms)

  // Tranzila V1 HMAC formula (confirmed by support):
  //   key  = appSecret + requestTime + nonce
  //   data = appKey
  //   output = lowercase hex (mirrors PHP hash_hmac default)
  const hmacKey    = cleanSecret + requestTime + nonce;
  const dataToSign = cleanKey;

  const signatureHex = crypto
    .createHmac('sha256', hmacKey)
    .update(dataToSign)
    .digest('hex');

  // Keep base64 in logs for reference only
  const signatureBase64 = crypto
    .createHmac('sha256', hmacKey)
    .update(dataToSign)
    .digest('base64');

  const signature = signatureHex;

  if (process.env.NODE_ENV !== 'production') {
    const peekKey =
      cleanKey.length > 4 ? `${cleanKey.slice(0, 2)}...${cleanKey.slice(-2)}` : '(too short)';
    const peekSecret =
      cleanSecret.length > 4 ? `${cleanSecret.slice(0, 2)}...${cleanSecret.slice(-2)}` : '(too short)';
    console.log(`[tranzila:auth] app_key   : '${peekKey}' (length ${cleanKey.length})`);
    console.log(`[tranzila:auth] app_secret: '${peekSecret}' (length ${cleanSecret.length})`);
    console.log('[tranzila:auth] nonce        :', nonce);
    console.log('[tranzila:auth] time         :', requestTime);
    console.log('[tranzila:auth] hmacKey len  :', hmacKey.length);
    console.log('[tranzila:auth] dataToSign   :', dataToSign);
    console.log('[tranzila:auth] sig (hex)    :', signatureHex);
    console.log('[tranzila:auth] sig (base64) :', signatureBase64);
    console.log('[tranzila:auth] SENDING      :', signature, '← hex');
  }

  return {
    'X-tranzila-api-app-key':      cleanKey,
    'X-tranzila-api-nonce':        nonce,
    'X-tranzila-api-request-time': requestTime,
    'X-tranzila-api-access-token': signature,
    'Content-Type':                'application/json'
  };
}

// ─── Response type ────────────────────────────────────────────────────────────

interface TranzilaV1Response {
  error_code: number;
  message: string;
  transaction_result?: {
    processor_response_code?: string;
    transaction_id?: number;
    auth_number?: string;
    amount?: number;
    card_type_name?: string;
    last_4?: string;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TranzilaService {

  /**
   * Returns true if the minimum required env vars are configured.
   * Callers should check this and fall back to mock mode when false.
   */
  isConfigured(): boolean {
    return !!(
      (process.env.TRANZILA_TERMINAL_NAME || '').trim() &&
      (process.env.TRANZILA_SUCCESS_URL   || '').trim()
    );
  }

  /**
   * Generate a Tranzila Hosted Payment Page (HPP) URL for AUTHORIZATION ONLY.
   *
   * Uses tranmode=V (Authorize / תפיסת מסגרת).
   * The customer is redirected to this URL; they fill in card details on Tranzila's
   * secure page. After payment Tranzila redirects the browser to TRANZILA_SUCCESS_URL.
   *
   * Anti-spoofing: we embed a server-generated `paymentSecurityToken` into `pdesc`
   * and `contact`. Tranzila echoes these back in the return call so we can verify
   * the callback wasn't forged.
   *
   * NOTE: The HPP flow (direct.tranzila.com) is separate from the V1 REST API and
   * remains unchanged. Only capturePayment / voidPayment use the new V1 endpoint.
   */
  generateAuthUrl(order: {
    _id: unknown;
    totalPrice: number;
    paymentSecurityToken: string;
    /** Override the success redirect URL (e.g. to embed orderId as a query param). */
    successUrl?: string;
  }): string {
    const terminal = (process.env.TRANZILA_TERMINAL_NAME || '').trim();
    if (!terminal) throw new Error('TRANZILA_TERMINAL_NAME is not set in environment');

    const hostedBase =
      (process.env.TRANZILA_HOSTED_URL || '').trim() ||
      `https://direct.tranzila.com/${encodeURIComponent(terminal)}/iframe.php`;

    const successUrl =
      order.successUrl?.trim() ||
      (process.env.TRANZILA_SUCCESS_URL || '').trim();
    if (!successUrl) throw new Error('TRANZILA_SUCCESS_URL is not set in environment');

    const params = new URLSearchParams();
    params.set('tranmode', 'VK');             // Verify (j5 pre-auth) + generate card Token
    params.set('Oredrid', String(order._id)); // Tranzila echoes this back
    params.set('myid',    String(order._id)); // Standard echo field
    params.set('sum', String(Math.round((Number(order.totalPrice) || 0) * 100) / 100));
    params.set('currency', '1');              // 1 = NIS
    params.set('success_url', successUrl);
    // Anti-spoofing: Tranzila echoes pdesc + contact back in the redirect
    params.set('pdesc',   order.paymentSecurityToken);
    params.set('contact', order.paymentSecurityToken);
    params.set('success_url_address', successUrl);

    return `${hostedBase}?${params.toString()}`;
  }

  /**
   * Capture (force/settle) a previously authorised transaction — V1 REST API.
   *
   * Uses the secure card token (ccard) issued by Tranzila via TranzilaTK=1 during the
   * HPP session. The token replaces the raw card number so no PCI-sensitive data is stored.
   */
  async capturePayment(
    transactionId: string,
    amount: number,
    authCode?: string,
    cardToken?: string,
    expireMonth?: number,
    expireYear?: number,
    orderContext?: TranzilaCaptureOrderContext
  ): Promise<TranzilaCaptureResult> {
    const terminal  = (process.env.TRANZILA_TERMINAL_NAME || '').trim();
    const appKey    = (process.env.TRANZILA_APP_KEY       || '').trim();
    const appSecret = (process.env.TRANZILA_APP_SECRET    || '').trim();

    if (!terminal)              throw new Error('TRANZILA_TERMINAL_NAME is not set');
    if (!appKey)                throw new Error('TRANZILA_APP_KEY is not set');
    if (!appSecret)             throw new Error('TRANZILA_APP_SECRET is not set');
    if (!transactionId?.trim()) throw new Error('transactionId is required for capture');

    const authCodeStr  = (authCode  || '').trim();
    const cardTokenStr = (cardToken || '').trim();

    if (!authCodeStr)  throw new Error('authCode (ConfirmationCode) is required for force capture');
    if (!cardTokenStr) throw new Error('Cannot force capture: Missing card token. This order may have been authorized before tokenization was enabled.');

    const expMonth = Number(expireMonth);
    const expYear  = Number(expireYear);
    if (!expireMonth || !expireYear || !Number.isFinite(expMonth) || !Number.isFinite(expYear) || expMonth < 1 || expMonth > 12) {
      throw new Error('Missing or invalid expiration date from initial authorization.');
    }

    const roundedAmount = roundMoney(amount);
    const refTxnId      = Number(transactionId.trim());

    const invoiceItems = orderContext
      ? buildTranzilaInvoiceItems({ ...orderContext, totalPrice: roundedAmount })
      : [{
          name:         'הזמנה',
          type:         'I' as const,
          unit_price:   roundedAmount,
          units_number: 1
        }];

    const client = orderContext ? resolveTranzilaCaptureClient(orderContext) : {};

    const body: Record<string, unknown> = {
      terminal_name:        terminal,
      txn_type:             'force',
      txn_currency_code:    'ILS',
      reference_txn_id:     refTxnId,
      authorization_number: authCodeStr,
      card_number:          cardTokenStr,
      expire_month:         expMonth,
      expire_year:          expYear,
      response_language:    'hebrew',
      imaindoc:             '1',
      email_recp:           '1',
      items:                invoiceItems,
      ...(Object.keys(client).length ? { client } : {}),
      ...(client.email ? { email: client.email } : {})
    };

    // Redact card_number (token) from logs — do not mutate the actual payload
    const logBody = {
      ...body,
      card_number: '***',
      items: invoiceItems.map((line) => ({
        name: line.name,
        type: line.type,
        unit_price: line.unit_price,
        units_number: line.units_number
      }))
    };
    console.log(
      `[tranzila:v1] capture → force | terminal=${terminal} | ref=${refTxnId} | amount=${roundedAmount} | items=${invoiceItems.length} | client=${JSON.stringify(client)} | body=${JSON.stringify(logBody)}`
    );

    try {
      const resp = await axios.post<TranzilaV1Response>(
        TRANZILA_V1_URL,
        body,
        {
          headers: generateTranzilaHeaders(appKey, appSecret),
          timeout: 15_000
        }
      );

      const data = resp.data;
      const raw  = JSON.stringify(data);
      console.log('[tranzila:v1] capture response:', raw.slice(0, 300));

      if (data.error_code !== 0) {
        throw new Error(`Tranzila V1 Error ${data.error_code}: ${data.message}`);
      }

      // Map to parsed dict for backward compatibility with payment.controller.ts
      // (controller reads result.parsed?.['index'] for the capture reference)
      const parsed: Record<string, string> = {
        error_code: String(data.error_code),
        message:    data.message || 'success'
      };
      if (data.transaction_result) {
        const tr = data.transaction_result;
        if (tr.transaction_id !== undefined) {
          parsed['index']          = String(tr.transaction_id);
          parsed['transaction_id'] = String(tr.transaction_id);
        }
        if (tr.auth_number)             parsed['auth_number'] = tr.auth_number;
        if (tr.processor_response_code) parsed['Response']    = tr.processor_response_code;
      }

      return { ok: true, raw, parsed };

    } catch (err: any) {
      // Surface Tranzila's own error body when available
      if (err?.response?.data) {
        const errData = err.response.data as Partial<TranzilaV1Response>;
        const msg = errData?.message || `HTTP ${err.response.status}`;
        throw new Error(
          `Tranzila V1 capture failed (${err.response.status}): ${msg} — ${JSON.stringify(errData).slice(0, 200)}`
        );
      }
      throw err;
    }
  }

  /**
   * Void (reversal) a pre-authorised transaction — V1 REST API.
   *
   * Maps to txn_type=reversal. Releases the credit-limit hold on the customer's card.
   * Only valid when paymentStatus === 'authorized'.
   *
   * @param transactionId  Tranzila transaction_id (ConfirmationCode) from HPP callback
   * @param authCode       auth_number / AuthCode returned by Tranzila during pre-auth
   */
  async voidPayment(
    transactionId: string,
    authCode?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const terminal  = (process.env.TRANZILA_TERMINAL_NAME || '').trim();
    const appKey    = (process.env.TRANZILA_APP_KEY       || '').trim();
    const appSecret = (process.env.TRANZILA_APP_SECRET    || '').trim();

    if (!terminal)              throw new Error('TRANZILA_TERMINAL_NAME is not set');
    if (!appKey)                throw new Error('TRANZILA_APP_KEY is not set');
    if (!appSecret)             throw new Error('TRANZILA_APP_SECRET is not set');
    if (!transactionId?.trim()) throw new Error('transactionId is required for void');

    const refTxnId = Number(transactionId.trim());

    // Minimal, clean body — no null/undefined fields, matches Tranzila V1 spec
    const body = {
      terminal_name:        terminal,
      txn_type:             'reversal',
      txn_currency_code:    'ILS',
      reference_txn_id:     refTxnId,
      authorization_number: (authCode || '0000000').trim()
    };

    console.log(`[tranzila:v1] void → reversal | terminal=${terminal} | ref=${refTxnId} | body=${JSON.stringify(body)}`);

    try {
      const resp = await axios.post<TranzilaV1Response>(
        TRANZILA_V1_URL,
        body,
        {
          headers: generateTranzilaHeaders(appKey, appSecret),
          timeout: 15_000
        }
      );

      const data = resp.data;
      const raw  = JSON.stringify(data);
      console.log('[tranzila:v1] void response:', raw.slice(0, 300));

      if (data.error_code === 0) return { ok: true };
      return {
        ok:    false,
        error: `Tranzila V1 reversal error ${data.error_code}: ${data.message}`
      };

    } catch (err: any) {
      if (err?.response?.data) {
        const errData = err.response.data as Partial<TranzilaV1Response>;
        const msg = errData?.message || `HTTP ${err.response.status}`;
        return { ok: false, error: `Tranzila V1 void failed: ${msg}` };
      }
      return { ok: false, error: err?.message || 'Tranzila void request failed' };
    }
  }
}
