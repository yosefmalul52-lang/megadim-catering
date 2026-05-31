import express from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = express.Router();
const payment = new PaymentController();

const { authenticate } = require('../middleware/auth');
const { requireAdmin }  = require('../config/role-access');

/**
 * Tranzila success redirect — browser lands here after the customer pays.
 * Tranzila supports both GET and POST depending on terminal configuration.
 * No auth required (the request comes from Tranzila's server / customer browser).
 */
router.get('/success',  payment.paymentSuccess);
router.post('/success', payment.paymentSuccess);

/**
 * Customer-facing: generate the Tranzila HPP URL for an existing order.
 * No auth required — guest checkout uses orderId to identify the order.
 */
router.post('/initiate/:orderId', payment.initiatePreAuth);

/**
 * Polling fallback: frontend queries payment status after returning from Tranzila.
 */
router.get('/status/:orderId', authenticate, payment.getPaymentStatus);

/**
 * Admin-only: capture (settle) an authorized pre-auth (tranmode=J).
 */
router.post('/capture/:orderId', authenticate, requireAdmin, payment.capturePayment);

/**
 * Admin-only: void an authorized hold (tranmode=V) — releases the card hold.
 */
router.post('/void/:orderId', authenticate, requireAdmin, payment.voidPayment);

export default router;
