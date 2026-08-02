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
 * Mock mode (development/test only, with Tranzila configuration absent):
 *   initiate returns successUrl directly → skips Tranzila page entirely (useful for local dev)
 */
import crypto from 'crypto';
import { Request, Response } from 'express';
import Order from '../models/Order';
import { TranzilaService, TranzilaCaptureOrderContext } from '../services/tranzila.service';
import { upsertCustomerFromOrder, normalizePhone } from '../services/customer.service';
import { emailService } from '../services/email.service';
import { ORDER_PAYMENT_OPERATION_SELECT } from '../utils/order-projection.util';
import {
  asyncHandler,
  createValidationError,
  createNotFoundError,
  createForbiddenError
} from '../middleware/errorHandler';

const tranzilaService = new TranzilaService();

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function userCanAccessOrderPaymentStatus(order: Record<string, unknown>, user: Record<string, unknown>): boolean {
  if (String(user?.role || '') === 'admin') return true;

  const userId = String(user?.id || user?._id || '').trim();
  const orderUserId = order?.userId != null ? String(order.userId).trim() : '';
  if (userId && orderUserId && userId === orderUserId) return true;

  const details = (order?.customerDetails ?? {}) as Record<string, unknown>;
  const orderPhone = normalizePhone(details.phone);
  const userPhone = normalizePhone(user?.phone);
  if (orderPhone && userPhone && orderPhone === userPhone) return true;

  const orderEmail = String(details.email || '')
    .trim()
    .toLowerCase();
  const userEmail = String(user?.username || '')
    .trim()
    .toLowerCase();
  if (orderEmail && userEmail && orderEmail === userEmail) return true;

  return false;
}

function paymentInitTokenIsValid(order: Record<string, any>, token: unknown): boolean {
  if (typeof token !== 'string' || !token.trim()) return false;

  const storedHash = String(order.paymentInitTokenHash || '');
  if (!/^[a-f0-9]{64}$/i.test(storedHash)) return false;

  const expiresAt = new Date(order.paymentInitTokenExpiresAt || 0).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const receivedHash = crypto.createHash('sha256').update(token).digest();
  const expectedHash = Buffer.from(storedHash, 'hex');
  return expectedHash.length === receivedHash.length &&
    crypto.timingSafeEqual(expectedHash, receivedHash);
}

function buildPaymentSuccessUrl(orderId: string): string {
  const backendBase = (
    process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`
  ).replace(/\/$/, '');
  const successBase = (
    process.env.TRANZILA_SUCCESS_URL || `${backendBase}/api/payment/success`
  ).trim();
  return `${successBase}?orderId=${encodeURIComponent(orderId)}`;
}

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
   * Mock mode (development/test only, with Tranzila configuration absent):
   *   Returns successUrl directly so local development works without credentials.
   */
  initiatePreAuth = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    if (!orderId) throw createValidationError('orderId is required');

    const paymentFields =
      '+paymentSecurityToken +paymentInitTokenHash +paymentInitTokenExpiresAt';
    const order = await Order.findById(orderId).select(paymentFields);
    if (!order) throw createNotFoundError('Order');

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');
    const user = (req as any).user as Record<string, unknown> | null | undefined;
    const hasOwnership = !!user &&
      userCanAccessOrderPaymentStatus(order as unknown as Record<string, unknown>, user);
    if (!hasOwnership && !paymentInitTokenIsValid(order as any, req.body?.paymentInitToken)) {
      return res.status(403).json({
        success: false,
        code: 'PAYMENT_INIT_FORBIDDEN',
        message: 'Payment initiation is not permitted'
      });
    }

    const providerConfigured = tranzilaService.isConfigured();
    const environment = String(process.env.NODE_ENV || '');
    const mockAllowed = !providerConfigured &&
      (environment === 'development' || environment === 'test');
    if (!providerConfigured && !mockAllowed) {
      return res.status(503).json({
        success: false,
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Payment provider is not configured'
      });
    }

    const conflict = () => res.status(409).json({
      success: false,
      code: 'PAYMENT_STATE_CONFLICT',
      message: 'Order cannot start payment in its current state'
    });

    const authorizeReloadedOrder = (current: any): boolean => {
      const currentOwner = !!user &&
        userCanAccessOrderPaymentStatus(current as Record<string, unknown>, user);
      return currentOwner || paymentInitTokenIsValid(current, req.body?.paymentInitToken);
    };

    const respondForSettledState = (current: any): Response | null => {
      if (current.paymentStatus === 'awaiting_payment') {
        const securityToken = String(current.paymentSecurityToken || '');
        if (!providerConfigured) {
          return res.status(200).json({
            success: true,
            redirectUrl: `${frontendBase}/order-confirmation/${orderId}?mock=1`,
            alreadyInitiated: true
          });
        }
        if (!securityToken) return conflict();
        const redirectUrl = tranzilaService.generateAuthUrl({
          _id: orderId,
          totalPrice: current.totalPrice,
          paymentSecurityToken: securityToken,
          successUrl: buildPaymentSuccessUrl(orderId)
        });
        return res.status(200).json({ success: true, redirectUrl, alreadyInitiated: true });
      }
      if (current.paymentStatus === 'authorized') {
        return res.status(200).json({
          success: true,
          alreadyAuthorized: true,
          redirectUrl: `${frontendBase}/order-confirmation/${orderId}`
        });
      }
      if (current.paymentStatus === 'captured' || current.paymentStatus === 'voided') {
        return conflict();
      }
      return null;
    };

    const settledResponse = respondForSettledState(order);
    if (settledResponse) return settledResponse;

    if (
      (order.paymentStatus !== 'pending' && order.paymentStatus !== 'failed') ||
      order.status !== 'pending'
    ) {
      return conflict();
    }

    if (mockAllowed) {
      const updated = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: 'pending',
          paymentStatus: order.paymentStatus
        },
        {
          $set: {
            paymentStatus: 'authorized',
            authorizedAmount: order.totalPrice,
            transactionId: order.transactionId || `MOCK-${Date.now()}`
          }
        },
        { new: true }
      ).select(paymentFields);

      if (!updated) {
        const reloaded = await Order.findById(orderId).select(paymentFields);
        if (!reloaded || !authorizeReloadedOrder(reloaded)) {
          return res.status(403).json({
            success: false,
            code: 'PAYMENT_INIT_FORBIDDEN',
            message: 'Payment initiation is not permitted'
          });
        }
        return respondForSettledState(reloaded) || conflict();
      }

      try {
        await upsertCustomerFromOrder(updated.toObject ? updated.toObject() : updated);
      } catch (crmErr) {
        console.error('[crm] payment backup upsert failed (mock authorize):', { orderId }, crmErr);
      }
      try {
        await emailService.sendOrderConfirmationAfterPayment(orderId);
      } catch (emailErr) {
        console.error('[payment] confirmation email failed (mock authorize):', { orderId }, emailErr);
      }

      return res.status(200).json({
        success: true,
        redirectUrl: `${frontendBase}/order-confirmation/${orderId}?mock=1`,
        message: 'Payment page URL generated'
      });
    }

    const paymentSecurityToken =
      (order as any).paymentSecurityToken || crypto.randomBytes(16).toString('hex');
    const transactionId = order.transactionId || `ORD-${orderId}`;
    const updated = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: 'pending',
        paymentStatus: order.paymentStatus
      },
      {
        $set: {
          paymentStatus: 'awaiting_payment',
          paymentSecurityToken,
          authorizedAmount: order.totalPrice,
          transactionId
        }
      },
      { new: true }
    ).select(paymentFields);

    if (!updated) {
      const reloaded = await Order.findById(orderId).select(paymentFields);
      if (!reloaded || !authorizeReloadedOrder(reloaded)) {
        return res.status(403).json({
          success: false,
          code: 'PAYMENT_INIT_FORBIDDEN',
          message: 'Payment initiation is not permitted'
        });
      }
      return respondForSettledState(reloaded) || conflict();
    }

    try {
      const redirectUrl = tranzilaService.generateAuthUrl({
        _id: orderId,
        totalPrice: updated.totalPrice,
        paymentSecurityToken: (updated as any).paymentSecurityToken,
        successUrl: buildPaymentSuccessUrl(orderId)
      });
      console.log(`[payment] Tranzila HPP URL built for order ${orderId}`);
      return res.status(200).json({
        success: true,
        redirectUrl,
        message: 'Payment page URL generated'
      });
    } catch (err: any) {
      console.error('[payment] Failed to generate Tranzila URL:', err.message);
      throw createValidationError(`Cannot build payment URL: ${err.message}`);
    }
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
    for (const k of ['pdesc', 'PDesc', 'contact', 'Contact', 'ccard', 'Ccard', 'ccno', 'TranzilaTK', 'expmonth', 'expyear']) {
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

    // index            = Tranzila's internal transaction ID → reference_txn_id in V1 capture/void
    // ConfirmationCode = Shva/bank authorization number   → authorization_number in V1 force/reversal
    // TranzilaTK       = Card token issued by tranmode=VK  → card_number in V1 force capture (primary)
    // ccard            = Alternate token field name        → card_number in V1 force capture (fallback)
    // expmonth/expyear = Card expiry from Tranzila         → expire_month/expire_year in V1 force
    const tranzilaIndex = (data['index'] || data['Index']) as string | undefined;
    const confirmationCode = (
      data['ConfirmationCode'] || data['TransactionId'] || data['transactionId']
    ) as string | undefined;

    const authCode    = (data['AuthCode'] || data['authCode']) as string | undefined;
    // tranmode=VK returns the token in the 'TranzilaTK' field; 'ccard' is the fallback field name
    const cardToken   = (data['TranzilaTK'] || data['ccard'] || data['Ccard']) as string | undefined;
    const expMonthRaw = (data['expmonth'] || data['ExpMonth']) as string | undefined;
    const expYearRaw  = (data['expyear']  || data['ExpYear'])  as string | undefined;

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
      // Safety net: backfill CRM if the initial order-save hook failed on a prior visit.
      try {
        await upsertCustomerFromOrder(order.toObject ? order.toObject() : order);
      } catch (crmErr) {
        console.error('[crm] payment backup upsert failed (idempotent redirect):', { orderId }, crmErr);
      }
      try {
        await emailService.sendOrderConfirmationAfterPayment(String(orderId));
      } catch (emailErr) {
        console.error('[payment] confirmation email failed (idempotent redirect):', { orderId }, emailErr);
      }
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
    // transactionId ← Tranzila `index`            (V1 reference_txn_id for capture/void)
    // authCode      ← Tranzila `ConfirmationCode`  (V1 authorization_number for force/reversal)
    // cardToken     ← Tranzila `ccard`             (secure token, replaces raw card_number in V1 force)
    // expireMonth   ← Tranzila `expmonth`          (card expiry month)
    // expireYear    ← Tranzila `expyear`            (card expiry year YY → converted to YYYY)
    const expMonth = expMonthRaw ? Number(expMonthRaw) : undefined;
    const expYear  = expYearRaw
      ? (expYearRaw.length === 2 ? Number('20' + expYearRaw) : Number(expYearRaw))
      : undefined;

    await Order.findByIdAndUpdate(orderId, {
      $set: {
        paymentStatus: 'authorized',
        ...(tranzilaIndex    ? { transactionId: String(tranzilaIndex) }    : {}),
        ...(confirmationCode ? { authCode:       String(confirmationCode) } : {}),
        ...(authCode && !confirmationCode ? { authCode: String(authCode) } : {}),
        ...(cardToken                 ? { cardToken }    : {}),
        ...(expMonth !== undefined    ? { expireMonth: expMonth } : {}),
        ...(expYear  !== undefined    ? { expireYear:  expYear  } : {})
      }
    });
    console.log(
      `[payment:success] Order ${orderId} authorized.`,
      `index(ref)=${tranzilaIndex}`,
      `ConfirmationCode(auth)=${confirmationCode}`,
      `cardToken=${cardToken ? '(present)' : '(absent)'}`,
      `expiry=${expMonth}/${expYear}`
    );

    // Safety net: ensure CRM customer exists even if the order-save hook failed earlier.
    try {
      const refreshedOrder = await Order.findById(orderId).lean();
      if (refreshedOrder) {
        await upsertCustomerFromOrder(refreshedOrder);
      } else {
        await upsertCustomerFromOrder(order.toObject ? order.toObject() : order);
      }
    } catch (crmErr) {
      console.error('[crm] payment backup upsert failed (payment success):', { orderId }, crmErr);
    }

    try {
      await emailService.sendOrderConfirmationAfterPayment(String(orderId));
    } catch (emailErr) {
      console.error('[payment] confirmation email failed (payment success):', { orderId }, emailErr);
    }

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

    const order = await Order.findById(orderId)
      .select(`${ORDER_PAYMENT_OPERATION_SELECT} items totalPrice deliveryFee subtotal customerDetails userId paymentStatus transactionId`)
      .populate('userId', 'fullName username')
      .lean();
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
    const linkedUser =
      (order as { userId?: { fullName?: string; username?: string } | string | null }).userId &&
      typeof (order as { userId?: unknown }).userId === 'object'
        ? ((order as { userId: { fullName?: string; username?: string } }).userId)
        : null;
    const captureAmount = roundMoney(Number(order.totalPrice ?? 0));
    const captureContext: TranzilaCaptureOrderContext = {
      items: order.items || [],
      totalPrice: captureAmount,
      deliveryFee: order.deliveryFee,
      subtotal: order.subtotal,
      customerDetails: order.customerDetails,
      userName: linkedUser?.fullName,
      userEmail: linkedUser?.username
    };

    let result;
    try {
      result = await tranzilaService.capturePayment(
        String(order.transactionId || ''),
        captureAmount,
        (order as { authCode?: string }).authCode,
        (order as { cardToken?: string }).cardToken,
        (order as { expireMonth?: number }).expireMonth,
        (order as { expireYear?: number }).expireYear,
        captureContext
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

    const order = await Order.findById(orderId).select(ORDER_PAYMENT_OPERATION_SELECT);
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

    const user = (req as any).user;
    if (!user) throw createForbiddenError('Authentication required');

    const order = await Order.findById(orderId)
      .select('paymentStatus authorizedAmount transactionId authCode userId customerDetails')
      .lean();
    if (!order) throw createNotFoundError('Order');

    if (!userCanAccessOrderPaymentStatus(order as unknown as Record<string, unknown>, user)) {
      throw createForbiddenError('Forbidden');
    }

    const isAdmin = String(user?.role || '') === 'admin';
    const payload: Record<string, unknown> = {
      success: true,
      paymentStatus: order.paymentStatus || 'pending',
      authorizedAmount: order.authorizedAmount ?? null
    };

    if (isAdmin) {
      payload.transactionId = order.transactionId ?? null;
      payload.authCode = order.authCode ?? null;
    }

    return res.status(200).json(payload);
  });
}
