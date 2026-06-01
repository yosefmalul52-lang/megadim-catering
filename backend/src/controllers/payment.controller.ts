/**
 * payment.controller.ts
 *
 * Pre-Authorization & Capture flow via Tranzila.
 *
 * Full flow:
 *   1. Customer submits checkout → POST /api/orders            (creates order record)
 *   2. Frontend → POST /api/payment/initiate/:orderId          (builds Tranzila HPP URL)
 *   3. Frontend → window.location.href = redirectUrl           (browser goes to Tranzila)
 *   4. Customer fills card details on Tranzila's secure page
 *   5. Tranzila → GET  /api/payment/success?Oredrid=...        (browser redirect back)
 *      (also receives POST in some Tranzila configs)
 *   6. Backend verifies security token + amount, sets paymentStatus = 'authorized'
 *   7. Backend redirects browser → /order-confirmation/:orderId
 *   8. Admin reviews order in dashboard → POST /api/payment/capture/:orderId  (J capture)
 *   9. Admin cancels → POST /api/payment/void/:orderId         (releases hold)
 *
 * Mock mode (no TRANZILA_TERMINAL_NAME set):
 *   initiate returns successUrl directly → skips Tranzila page entirely (useful for local dev)
 */
import crypto from 'crypto';
import { Request, Response } from 'express';
import Order from '../models/Order';
import { TranzilaService } from '../services/tranzila.service';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';

const tranzilaService = new TranzilaService();

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
export class PaymentController {

  /**
   * POST /api/payment/initiate/:orderId
   *
   * Generates the Tranzila HPP URL and returns it to the frontend.
   * The frontend does: window.location.href = redirectUrl
   *
   * Mock mode (TRANZILA_TERMINAL_NAME not set):
   *   Returns successUrl directly so local development works without credentials.
   */
  initiatePreAuth = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    if (!orderId) throw createValidationError('orderId is required');

    // Must use +paymentSecurityToken since it's select:false
    const order = await Order.findById(orderId).select('+paymentSecurityToken');
    if (!order) throw createNotFoundError('Order');

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

    // Idempotency guards
    if (order.paymentStatus === 'awaiting_payment') {
      // Already initiated – rebuild the same URL without changing state
      const ref = order.transactionId || `ORD-${orderId}`;
      const redirectUrl = tranzilaService.isConfigured()
        ? tranzilaService.generateAuthUrl({
            _id: orderId,
            totalPrice: order.totalPrice,
            paymentSecurityToken: (order as any).paymentSecurityToken || ref
          })
        : `${frontendBase}/order-confirmation/${orderId}?mock=1`;
      return res.status(200).json({ success: true, redirectUrl, alreadyInitiated: true });
    }
    if (order.paymentStatus === 'authorized') {
      return res.status(200).json({
        success: true, alreadyAuthorized: true,
        redirectUrl: `${frontendBase}/order-confirmation/${orderId}`
      });
    }
    if (order.paymentStatus === 'captured') {
      throw createValidationError('Order has already been captured');
    }
    if (order.paymentStatus === 'voided') {
      throw createValidationError('Order was voided; start a new order to retry payment');
    }

    // Generate one-time security token (anti-spoofing)
    const paymentSecurityToken = crypto.randomBytes(16).toString('hex');

    // Persist before redirect so the token is available when Tranzila calls back
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        paymentStatus:        'awaiting_payment',
        // NOTE: do NOT set `status` here — it uses a different enum for
        // kitchen/operational tracking. Payment state lives in `paymentStatus`.
        paymentSecurityToken,
        authorizedAmount:     order.totalPrice,
        transactionId:        `ORD-${orderId}` // placeholder; overwritten on paymentSuccess
      }
    });

    let redirectUrl: string;

    if (!tranzilaService.isConfigured()) {
      // ── Mock mode ────────────────────────────────────────────────────────────
      console.warn(
        '[payment] TRANZILA_TERMINAL_NAME / TRANZILA_SUCCESS_URL not set.\n' +
        '  → Running in MOCK mode: redirecting directly to order-confirmation.\n' +
        '  → Add TRANZILA_TERMINAL_NAME and TRANZILA_SUCCESS_URL to backend/.env to enable real payments.'
      );
      redirectUrl = `${frontendBase}/order-confirmation/${orderId}?mock=1`;
      // In mock mode, immediately mark as authorized so admin can see and capture
      await Order.findByIdAndUpdate(orderId, {
        $set: { paymentStatus: 'authorized', transactionId: `MOCK-${Date.now()}` }
      });    } else {
      // ── Real Tranzila mode ───────────────────────────────────────────────────
      try {
        // Embed orderId in success_url so it arrives reliably regardless of which
        // Tranzila params they echo back. Tranzila appends its own params to our URL.
        const backendBase = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
        const tranzilaSuccessBase = (process.env.TRANZILA_SUCCESS_URL || `${backendBase}/api/payment/success`).trim();
        const successUrl = `${tranzilaSuccessBase}?orderId=${encodeURIComponent(orderId)}`;

        redirectUrl = tranzilaService.generateAuthUrl({
          _id:                  orderId,
          totalPrice:           order.totalPrice,
          paymentSecurityToken,
          successUrl
        });
        console.log(`[payment] Tranzila HPP URL built for order ${orderId}: ${redirectUrl.slice(0, 80)}…`);
      } catch (err: any) {
        console.error('[payment] Failed to generate Tranzila URL:', err.message);
        throw createValidationError(`Cannot build payment URL: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      redirectUrl,
      message: 'Payment page URL generated'
    });
  });

  /**
   * GET/POST /api/payment/success
   *
   * Tranzila redirects the customer's browser here after payment.
   * Also receives POST in some Tranzila configurations (IPN).
   *
   * Security checks:
   *   1. Verify Response code = '000'
   *   2. Verify paymentSecurityToken (anti-spoofing)
   *   3. Verify amount (anti-tampering)
   *   4. Idempotency — already authorized orders are redirected without re-processing
   *
   * On success: redirects browser → /order-confirmation/:orderId
   * On failure: redirects browser → /checkout?paymentError=...&orderId=...
   */
  paymentSuccess = asyncHandler(async (req: Request, res: Response) => {
    // ── Sanitized diagnostic log — omit pdesc/contact to avoid token leakage ──
    const logQuery = { ...req.query } as Record<string, any>;
    const logBody  = { ...req.body  } as Record<string, any>;
    for (const k of ['pdesc', 'PDesc', 'contact', 'Contact']) {
      delete logQuery[k];
      delete logBody[k];
    }
    console.log('[payment:success] Incoming callback —',
      'method:', req.method,
      'query:', JSON.stringify(logQuery),
      'body:', JSON.stringify(logBody)
    );

    // Merge query + body: some Tranzila configurations send a GET redirect with
    // query params; others POST form-data. We support both by merging both sources.
    const data: Record<string, any> = {
      ...(req.body  || {}),   // form-urlencoded POST body (parsed by express.urlencoded)
      ...(req.query || {})    // GET query params (or params appended to POST redirect)
    };

    // orderId extraction — priority order:
    //   1. orderId  – embedded by us in the success_url (?orderId=...)  ← most reliable
    //   2. myid     – Tranzila standard echo field
    //   3. Oredrid  – Tranzila misspelling of "OrderId" (standard field)
    //   4. Other case variants
    const orderId = (
      data['orderId']  || data['OrderId']  ||
      data['myid']     || data['myId']     ||
      data['Oredrid']  || data['orderid']  ||
      data['Orderid']
    ) as string | undefined;

    // index   = Tranzila's internal transaction ID → used as reference_txn_id in V1 capture/void
    // ConfirmationCode = Shva/bank authorization number → used as authorization_number in V1 reversal
    const tranzilaIndex = (data['index'] || data['Index']) as string | undefined;
    const confirmationCode = (
      data['ConfirmationCode'] || data['TransactionId'] || data['transactionId']
    ) as string | undefined;

    const authCode = (data['AuthCode'] || data['authCode']) as string | undefined;

    const returnedToken = (
      data['pdesc']   || data['PDesc'] ||
      data['contact'] || data['Contact']
    ) as string | undefined;

    const sumRaw = (data['sum'] || data['Sum']) as string | undefined;

    const responseCodeRaw = (
      data['Response'] || data['response'] || data['RESULT'] || data['Result']
    ) as string | undefined;

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

    // ── 0. Basic param check ─────────────────────────────────────────────────
    if (!orderId) {
      console.warn('[payment:success] Missing orderId in callback');
      return res.redirect(`${frontendBase}/checkout?paymentError=missing_order`);
    }

    // ── 1. Check Tranzila response code — FAIL CLOSED ───────────────────────
    // A missing or empty response code is treated as a failure, not a bypass.
    const rc = String(responseCodeRaw ?? '').trim();
    if (rc !== '000' && rc !== '0') {
      console.warn(`[payment:success] Bad or absent response code '${rc}' for order ${orderId}`);
      await Order.findByIdAndUpdate(orderId, { $set: { paymentStatus: 'failed' } }).catch(() => {});
      return res.redirect(`${frontendBase}/checkout?paymentError=declined&orderId=${orderId}`);
    }

    // ── 2. Load order (include security token) ───────────────────────────────
    const order = await Order.findById(String(orderId)).select('+paymentSecurityToken');
    if (!order) {
      console.warn(`[payment:success] Order ${orderId} not found`);
      return res.redirect(`${frontendBase}/checkout?paymentError=order_not_found`);
    }

    // ── 3. Idempotency ──────────────────────────────────────────────────────
    if (order.paymentStatus === 'authorized' || order.paymentStatus === 'captured') {
      return res.redirect(`${frontendBase}/order-confirmation/${orderId}`);
    }

    // ── 4. Verify security token — MANDATORY, FAIL CLOSED ───────────────────
    // Both the DB token and the returned token must be present and match exactly.
    // If the DB token is missing (e.g. order never went through initiatePreAuth),
    // we reject the callback — it cannot be a legitimate Tranzila redirect.
    const expectedToken = (order as any).paymentSecurityToken as string | undefined;
    if (!expectedToken || !returnedToken || String(returnedToken).trim() !== expectedToken.trim()) {
      console.warn(`[payment:success] Security token missing or mismatch for order ${orderId}`);
      return res.redirect(`${frontendBase}/checkout?paymentError=security&orderId=${orderId}`);
    }

    // ── 5. Verify amount (if Tranzila provides it) ───────────────────────────
    if (sumRaw !== undefined && sumRaw !== null && String(sumRaw).trim() !== '') {
      const paid     = Number(String(sumRaw).replace(',', '.'));
      const expected = Number(order.totalPrice ?? 0);
      if (Number.isFinite(paid) && Number.isFinite(expected)) {
        const diff = Math.abs(paid - expected);
        if (diff > 0.02) {
          console.warn(`[payment:success] Amount mismatch for order ${orderId}: paid ${paid} vs expected ${expected}`);
          await Order.findByIdAndUpdate(orderId, { $set: { paymentStatus: 'failed' } }).catch(() => {});
          return res.redirect(`${frontendBase}/checkout?paymentError=amount_mismatch&orderId=${orderId}`);
        }
      }
    }

    // ── 6. All checks passed — authorize ─────────────────────────────────────
    // transactionId ← Tranzila `index`           (V1 reference_txn_id for capture/void)
    // authCode      ← Tranzila `ConfirmationCode` (V1 authorization_number for reversal)
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        paymentStatus: 'authorized',
        ...(tranzilaIndex    ? { transactionId: String(tranzilaIndex) }    : {}),
        ...(confirmationCode ? { authCode:       String(confirmationCode) } : {}),
        // Fallback: if Tranzila didn't send index but sent AuthCode, store it
        ...(authCode && !confirmationCode ? { authCode: String(authCode) } : {})
      }
    });
    console.log(
      `[payment:success] Order ${orderId} authorized.`,
      `index(ref)=${tranzilaIndex}`,
      `ConfirmationCode(auth)=${confirmationCode}`
    );

    return res.redirect(`${frontendBase}/order-confirmation/${orderId}`);
  });

  /**
   * POST /api/payment/capture/:orderId   (Admin only)
   *
   * Settles a pre-authorised transaction via TranzilaService.capturePayment (tranmode=J).
   * Only callable when paymentStatus === 'authorized'.
   */
  capturePayment = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    if (!orderId) throw createValidationError('orderId is required');

    const order = await Order.findById(orderId);
    if (!order) throw createNotFoundError('Order');

    if (order.paymentStatus !== 'authorized') {
      throw createValidationError(
        `Cannot capture: paymentStatus is '${order.paymentStatus}'. Only 'authorized' orders can be captured.`
      );
    }
    if (!order.transactionId) {
      throw createValidationError('Missing transactionId on order; cannot capture');
    }
    // Guard: if transactionId is still our placeholder, Tranzila hasn't confirmed yet
    if (order.transactionId.startsWith('ORD-') || order.transactionId.startsWith('MOCK-')) {
      throw createValidationError(
        'Tranzila confirmation code not yet received. ' +
        'Please wait a moment and try again.'
      );
    }

    // Idempotency
    if ((order.paymentStatus as string) === 'captured') {
      return res.status(200).json({ success: true, alreadyCaptured: true, message: 'Order already captured' });
    }

    // ── Mock mode ──────────────────────────────────────────────────────────────
    if (!tranzilaService.isConfigured()) {
      console.warn('[payment:capture] Mock mode — skipping real Tranzila capture');
      await Order.findByIdAndUpdate(orderId, { $set: { paymentStatus: 'captured', status: 'processing' } });
      return res.status(200).json({ success: true, captureRef: `CAP-MOCK-${Date.now()}`, message: 'Payment captured (mock)' });
    }

    // ── Real capture ───────────────────────────────────────────────────────────
    let result;
    try {
      result = await tranzilaService.capturePayment(
        order.transactionId,
        order.totalPrice,
        order.authCode
      );
    } catch (err: any) {
      console.error('[payment:capture] TranzilaService error:', err.message);
      const isBlocked = /waf|block|ip/i.test(err.message || '');
      return res.status(isBlocked ? 400 : 502).json({
        success: false,
        message: err.message || 'Capture failed at payment provider'
      });
    }

    if (!result.ok) {
      console.error('[payment:capture] Capture failed:', result.raw);
      await Order.findByIdAndUpdate(orderId, { $set: { paymentStatus: 'failed' } });
      return res.status(502).json({ success: false, message: 'Capture failed', gateway: result.raw.slice(0, 200) });
    }

    await Order.findByIdAndUpdate(orderId, {
      $set: { paymentStatus: 'captured', status: 'processing' }
    });

    return res.status(200).json({
      success: true,
      captureRef: result.parsed?.['index'] || order.transactionId,
      message: 'Payment captured successfully'
    });
  });

  /**
   * POST /api/payment/void/:orderId   (Admin only)
   *
   * Releases the pre-auth hold via TranzilaService.voidPayment (tranmode=V).
   * Only callable when paymentStatus === 'authorized'.
   */
  voidPayment = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    if (!orderId) throw createValidationError('orderId is required');

    const order = await Order.findById(orderId);
    if (!order) throw createNotFoundError('Order');

    if (order.paymentStatus !== 'authorized') {
      throw createValidationError(
        `Cannot void: paymentStatus is '${order.paymentStatus}'. Only 'authorized' orders can be voided.`
      );
    }
    if (!order.transactionId) {
      throw createValidationError('Missing transactionId; cannot void');
    }
    if (order.transactionId.startsWith('ORD-') || order.transactionId.startsWith('MOCK-')) {
      throw createValidationError('Tranzila index not yet available; cannot void. Wait for IPN or try again.');
    }

    // Mock mode
    if (!tranzilaService.isConfigured()) {
      await Order.findByIdAndUpdate(orderId, { $set: { paymentStatus: 'voided', status: 'cancelled' } });
      return res.status(200).json({ success: true, message: 'Authorization voided (mock)' });
    }

    const result = await tranzilaService.voidPayment(order.transactionId, order.authCode);

    if (!result.ok) {
      return res.status(502).json({ success: false, message: result.error || 'Void failed at Tranzila' });
    }

    await Order.findByIdAndUpdate(orderId, {
      $set: { paymentStatus: 'voided', status: 'cancelled' }
    });

    return res.status(200).json({ success: true, message: 'Authorization voided; hold released on card' });
  });

  /**
   * GET /api/payment/status/:orderId
   * Returns the current payment state from DB (used for polling / page refresh).
   */
  getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    if (!orderId) throw createValidationError('orderId is required');

    const order = await Order.findById(orderId).lean();
    if (!order) throw createNotFoundError('Order');

    return res.status(200).json({
      success: true,
      paymentStatus:    order.paymentStatus   || 'pending',
      transactionId:    order.transactionId,
      authCode:         order.authCode,
      authorizedAmount: order.authorizedAmount
    });
  });
}
