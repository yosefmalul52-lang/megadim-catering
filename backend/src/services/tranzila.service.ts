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

// ─── Auth Header Helper ───────────────────────────────────────────────────────

/**
 * Generates the 4 HMAC-signed headers required by the Tranzila V1 REST API.
 *
 * Signature formula (per Tranzila docs):
 *   HMAC-SHA256(key = APP_SECRET, data = APP_KEY + request_time + nonce)
 *
 * - nonce:        40-character hex string, unique per request
 * - request_time: Unix timestamp in milliseconds
 */
function generateTranzilaHeaders(appKey: string, appSecret: string): Record<string, string> {
  const nonce       = crypto.randomBytes(20).toString('hex'); // 40 hex chars
  const requestTime = String(Date.now());                     // Unix ms as string

  const signature = crypto
    .createHmac('sha256', appSecret)
    .update(appKey + requestTime + nonce)
    .digest('hex');

  return {
    'X-tranzila-api-app-key':      appKey,
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
    params.set('tranmode', 'V');              // Authorization only (pre-auth / J5)
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
   * Maps to txn_type=force with reference_txn_id (the ConfirmationCode / transaction_id
   * returned by Tranzila when the customer completed the HPP payment form).
   *
   * No card details are required: Tranzila already holds them against the reference_txn_id.
   */
  async capturePayment(
    transactionId: string,
    amount: number,
    authCode?: string
  ): Promise<TranzilaCaptureResult> {
    const terminal  = (process.env.TRANZILA_TERMINAL_NAME || '').trim();
    const appKey    = (process.env.TRANZILA_APP_KEY       || '').trim();
    const appSecret = (process.env.TRANZILA_APP_SECRET    || '').trim();

    if (!terminal)              throw new Error('TRANZILA_TERMINAL_NAME is not set');
    if (!appKey)                throw new Error('TRANZILA_APP_KEY is not set');
    if (!appSecret)             throw new Error('TRANZILA_APP_SECRET is not set');
    if (!transactionId?.trim()) throw new Error('transactionId is required for capture');

    const roundedAmount   = Math.round((Number(amount) || 0) * 100) / 100;
    const refTxnId        = Number(transactionId.trim());

    const body: Record<string, unknown> = {
      terminal_name:    terminal,
      txn_type:         'force',
      reference_txn_id: refTxnId,
      items: [
        {
          name:         'הזמנת קייטרינג',
          type:         'I',
          unit_price:   roundedAmount,
          units_number: 1
        }
      ]
    };

    console.log(`[tranzila:v1] capture → force | ref=${refTxnId} | amount=${roundedAmount}`);

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

    const body: Record<string, unknown> = {
      terminal_name:        terminal,
      txn_type:             'reversal',
      reference_txn_id:     refTxnId,
      // authorization_number is required by Tranzila for reversal;
      // fall back to '0000000' if not stored (safe default per Tranzila docs example)
      authorization_number: (authCode || '0000000').trim()
    };

    console.log(`[tranzila:v1] void → reversal | ref=${refTxnId}`);

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
