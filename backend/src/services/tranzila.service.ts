/**
 * tranzila.service.ts
 *
 * Tranzila (Israeli payment provider) adapter.
 *
 * Required ENV vars:
 *   TRANZILA_TERMINAL_NAME   – your supplier / terminal name
 *   TRANZILA_HOSTED_URL      – (optional) hosted-payment-page base URL
 *                              defaults to https://direct.tranzila.com/{terminal}/iframe.php
 *   TRANZILA_SUCCESS_URL     – backend URL Tranzila redirects the browser to after payment
 *                              e.g. https://api.megadim-catering.com/api/payment/success
 *   TRANZILA_CAPTURE_URL     – (optional) server-to-server CGI endpoint for capture/void
 *                              defaults to https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi
 *   TRANZILA_CAPTURE_PASSWORD – terminal password for server-to-server calls
 */
import axios from 'axios';

export type TranzilaCaptureResult = {
  ok: boolean;
  raw: string;
  parsed?: Record<string, string>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTranzilaResponse(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw
    .split(/[\n&]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
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

    // Prefer the caller's per-order URL (contains orderId) over the bare env URL
    const successUrl =
      order.successUrl?.trim() ||
      (process.env.TRANZILA_SUCCESS_URL || '').trim();
    if (!successUrl) throw new Error('TRANZILA_SUCCESS_URL is not set in environment');

    const params = new URLSearchParams();
    params.set('tranmode', 'V');            // Authorization only (pre-auth)
    params.set('Oredrid', String(order._id)); // Tranzila echoes this back as Oredrid
    params.set('myid',    String(order._id)); // Tranzila standard field — also echoed back
    params.set('sum', String(Math.round((Number(order.totalPrice) || 0) * 100) / 100));
    params.set('currency', '1');            // 1 = NIS
    params.set('success_url', successUrl);
    // Anti-spoofing: Tranzila echoes pdesc + contact back in the redirect
    params.set('pdesc',   order.paymentSecurityToken);
    params.set('contact', order.paymentSecurityToken);
    // Some Tranzila configs use this alternate key
    params.set('success_url_address', successUrl);

    return `${hostedBase}?${params.toString()}`;
  }

  /**
   * Capture a previously authorised transaction (server-to-server, tranmode=J).
   *
   * `transactionId` is the ConfirmationCode / index Tranzila sent back during auth.
   * Falls back through several common CGI endpoint variants if the first returns 404.
   */
  async capturePayment(
    transactionId: string,
    amount: number,
    authCode?: string
  ): Promise<TranzilaCaptureResult> {
    const terminal = (process.env.TRANZILA_TERMINAL_NAME || '').trim();
    if (!terminal) throw new Error('TRANZILA_TERMINAL_NAME is not set');
    if (!transactionId?.trim()) throw new Error('transactionId is required for capture');

    const pw = (process.env.TRANZILA_CAPTURE_PASSWORD || '').trim();
    if (!pw) throw new Error('TRANZILA_CAPTURE_PASSWORD is not set');

    // Try configured endpoint first, then fall back to common alternatives
    const captureUrlCandidates: string[] = [];
    const configuredUrl = (process.env.TRANZILA_CAPTURE_URL || '').trim();
    if (configuredUrl && /^https?:\/\//i.test(configuredUrl)) captureUrlCandidates.push(configuredUrl);
    captureUrlCandidates.push(
      'https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi',
      'https://secure5.tranzila.com/cgi-bin/tranzila71.cgi',
      'https://secure5.tranzila.com/cgi-bin/tranzila31h.cgi'
    );

    const sum = String(Math.round((Number(amount) || 0) * 100) / 100);
    const normalizedTx = String(transactionId).trim();

    const body = new URLSearchParams();
    body.set('supplier',   terminal);
    body.set('TranzilaPW', pw);
    body.set('tranmode',   'J');   // Delayed capture of pre-authorised transaction
    body.set('authnr',     normalizedTx);
    body.set('index',      normalizedTx);
    body.set('sum',        sum);
    if (authCode?.trim()) body.set('AuthCode', authCode.trim());

    let lastErr: unknown = null;
    for (const captureUrl of captureUrlCandidates) {
      try {
        const resp = await axios.post(captureUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15_000
        });

        const raw = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        console.log('[tranzila] capture raw response:', raw.slice(0, 300));

        // Detect WAF / HTML block pages
        const rawLower = raw.toLowerCase();
        if (rawLower.includes('<html') || rawLower.includes('<body')) {
          const redFontMatch = raw.match(/<font[^>]*color\s*=\s*["']?red[^>]*>([\s\S]*?)<\/font>/i);
          const bMatch        = raw.match(/<b[^>]*>([\s\S]*?)<\/b>/i);
          const extracted     = (redFontMatch?.[1] || bMatch?.[1] || '').trim();
          const cleaned = extracted
            ? decodeHtmlEntities(extracted.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
            : 'Tranzila WAF / IP block';
          throw new Error(`Tranzila WAF blocked: ${cleaned}`);
        }

        const parsed       = parseTranzilaResponse(raw);
        const responseCode = (parsed['Response'] || parsed['response'] || '').trim();

        if (responseCode && responseCode !== '000') {
          throw new Error(`Tranzila Error Code: ${responseCode}`);
        }
        if (!responseCode) {
          const snippet = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
          throw new Error(`Unexpected Tranzila response (no Response=000): ${snippet}`);
        }

        return { ok: true, raw, parsed };
      } catch (err: any) {
        lastErr = err;
        if (err?.response?.status === 404) continue; // try next endpoint
        throw err;
      }
    }

    throw lastErr || new Error('Tranzila capture failed: no valid endpoint');
  }

  /**
   * Void a pre-authorised transaction — releases the hold on the customer's card.
   * Uses tranmode=V (Void).
   */
  async voidPayment(transactionId: string): Promise<{ ok: boolean; error?: string }> {
    const terminal = (process.env.TRANZILA_TERMINAL_NAME || '').trim();
    if (!terminal) throw new Error('TRANZILA_TERMINAL_NAME is not set');
    if (!transactionId?.trim()) throw new Error('transactionId is required for void');

    const pw = (process.env.TRANZILA_CAPTURE_PASSWORD || '').trim();
    if (!pw) throw new Error('TRANZILA_CAPTURE_PASSWORD is not set');

    const captureUrl =
      (process.env.TRANZILA_CAPTURE_URL || 'https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi').trim();

    const body = new URLSearchParams();
    body.set('supplier',   terminal);
    body.set('TranzilaPW', pw);
    body.set('tranmode',   'V');   // Void
    body.set('index',      String(transactionId).trim());

    try {
      const resp = await axios.post(captureUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000
      });

      const raw = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      console.log('[tranzila] void raw response:', raw.slice(0, 300));

      const parsed       = parseTranzilaResponse(raw);
      const responseCode = (parsed['Response'] || parsed['response'] || '').trim();

      if (responseCode === '000') return { ok: true };
      return { ok: false, error: `Tranzila void error ${responseCode}: ${raw.slice(0, 200)}` };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Tranzila void request failed' };
    }
  }
}
