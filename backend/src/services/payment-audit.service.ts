import { Request } from 'express';
import PaymentAuditEvent, {
  PaymentAuditActorType,
  PaymentAuditEventType,
  PaymentAuditResult
} from '../models/PaymentAuditEvent';

export type SafePaymentReasonCode =
  | 'INIT_FORBIDDEN'
  | 'STATE_CONFLICT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'LOCK_CONFLICT'
  | 'GATEWAY_DECLINED'
  | 'GATEWAY_ERROR'
  | 'NETWORK_OR_TIMEOUT'
  | 'STATE_RACE'
  | 'MISSING_TRANSACTION_REF'
  | 'AWAITING_PROVIDER_INDEX'
  | 'SECURITY_TOKEN_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'DECLINED_BY_PROVIDER'
  | 'ALREADY_SETTLED';

export type RecordPaymentAuditInput = {
  orderId: string;
  orderNumber?: string | null;
  eventType: PaymentAuditEventType;
  paymentStatusBefore?: string | null;
  paymentStatusAfter?: string | null;
  result: PaymentAuditResult;
  actorType: PaymentAuditActorType;
  actorId?: string | null;
  actorDisplayName?: string | null;
  safeReasonCode?: SafePaymentReasonCode | string | null;
  eventKey?: string | null;
};

export type PaymentHistoryApiItem = {
  id: string;
  eventType: PaymentAuditEventType;
  eventTypeLabelHe: string;
  createdAt: string;
  paymentStatusBefore: string | null;
  paymentStatusAfter: string | null;
  result: PaymentAuditResult;
  resultLabelHe: string;
  actorType: PaymentAuditActorType;
  actorTypeLabelHe: string;
  actorDisplayName: string | null;
  safeReasonCode: string | null;
  safeReasonLabelHe: string | null;
};

const EVENT_LABEL_HE: Record<PaymentAuditEventType, string> = {
  payment_initiated: 'התחלת תשלום',
  payment_initiate_blocked: 'התחלת תשלום נחסמה',
  payment_authorized: 'אישור הרשאה',
  capture_started: 'התחלת חיוב',
  capture_completed: 'חיוב הושלם',
  capture_failed: 'חיוב נכשל',
  capture_result_unknown: 'תוצאת חיוב לא ודאית, נדרשת בדיקה ידנית',
  capture_blocked: 'חיוב נחסם',
  void_completed: 'ביטול הרשאה הושלם',
  void_failed: 'ביטול הרשאה נכשל'
};

const RESULT_LABEL_HE: Record<PaymentAuditResult, string> = {
  success: 'הצלחה',
  failed: 'כישלון',
  blocked: 'חסימה',
  unknown: 'לא ודאי'
};

const ACTOR_LABEL_HE: Record<PaymentAuditActorType, string> = {
  customer: 'לקוח',
  guest: 'אורח',
  admin: 'מנהל',
  system: 'מערכת'
};

const REASON_LABEL_HE: Record<string, string> = {
  INIT_FORBIDDEN: 'אין הרשאה להתחיל תשלום',
  STATE_CONFLICT: 'סטטוס ההזמנה אינו מאפשר את הפעולה',
  PROVIDER_NOT_CONFIGURED: 'ספק התשלומים אינו מוגדר',
  LOCK_CONFLICT: 'חיוב כבר בתהליך או נעול לבדיקה',
  GATEWAY_DECLINED: 'העסקה נדחתה בספק',
  GATEWAY_ERROR: 'שגיאה בספק התשלומים',
  NETWORK_OR_TIMEOUT: 'תקלת רשת או פסק זמן מול הספק',
  STATE_RACE: 'מצב ההזמנה השתנה במהלך הפעולה',
  MISSING_TRANSACTION_REF: 'חסר מזהה עסקה',
  AWAITING_PROVIDER_INDEX: 'ממתין לאישור ספק',
  SECURITY_TOKEN_MISMATCH: 'אימות אבטחה נכשל',
  AMOUNT_MISMATCH: 'אי-התאמה בסכום',
  DECLINED_BY_PROVIDER: 'נדחה על ידי הספק',
  ALREADY_SETTLED: 'העסקה כבר יושבה'
};

const FORBIDDEN_AUDIT_KEYS = [
  'paymentInitToken',
  'paymentInitTokenHash',
  'paymentSecurityToken',
  'captureLockId',
  'cardToken',
  'authCode',
  'expireMonth',
  'expireYear',
  'TRANZILA_APP_SECRET',
  'TRANZILA_APP_KEY',
  'requestBody',
  'raw',
  'gateway'
];

export function resolvePaymentActor(req?: Request | null): {
  actorType: PaymentAuditActorType;
  actorId?: string | null;
  actorDisplayName?: string | null;
} {
  const user = (req as any)?.user as Record<string, unknown> | null | undefined;
  if (!user) {
    return { actorType: 'guest', actorId: null, actorDisplayName: null };
  }

  const role = String(user.role || '').trim();
  const actorId = String(user.id || user._id || '').trim() || null;
  if (role === 'admin') {
    const name =
      String(user.fullName || '').trim() ||
      String(user.username || '').trim() ||
      null;
    return { actorType: 'admin', actorId, actorDisplayName: name };
  }

  return {
    actorType: 'customer',
    actorId,
    actorDisplayName: null
  };
}

function sanitizeAuditPayload(input: RecordPaymentAuditInput): RecordPaymentAuditInput {
  const safe: RecordPaymentAuditInput = {
    orderId: String(input.orderId),
    orderNumber: input.orderNumber ? String(input.orderNumber).slice(0, 64) : null,
    eventType: input.eventType,
    paymentStatusBefore: input.paymentStatusBefore ? String(input.paymentStatusBefore).slice(0, 40) : null,
    paymentStatusAfter: input.paymentStatusAfter ? String(input.paymentStatusAfter).slice(0, 40) : null,
    result: input.result,
    actorType: input.actorType,
    actorId: input.actorId ? String(input.actorId).slice(0, 64) : null,
    actorDisplayName:
      input.actorType === 'admin' && input.actorDisplayName
        ? String(input.actorDisplayName).slice(0, 120)
        : null,
    safeReasonCode: input.safeReasonCode ? String(input.safeReasonCode).slice(0, 64) : null,
    eventKey: input.eventKey ? String(input.eventKey).slice(0, 160) : null
  };
  return safe;
}

/**
 * Persist a payment audit row. Never throws to callers — failures are logged only.
 * Duplicate eventKey is treated as success (idempotent).
 */
export async function recordPaymentAuditEvent(input: RecordPaymentAuditInput): Promise<boolean> {
  try {
    const safe = sanitizeAuditPayload(input);
    await PaymentAuditEvent.create({
      orderId: safe.orderId,
      orderNumber: safe.orderNumber,
      eventType: safe.eventType,
      paymentStatusBefore: safe.paymentStatusBefore,
      paymentStatusAfter: safe.paymentStatusAfter,
      result: safe.result,
      actorType: safe.actorType,
      actorId: safe.actorId,
      actorDisplayName: safe.actorDisplayName,
      safeReasonCode: safe.safeReasonCode,
      eventKey: safe.eventKey || undefined
    });
    return true;
  } catch (err: any) {
    if (err?.code === 11000) return true;
    console.error('[payment-audit] write failed', {
      orderId: input.orderId,
      eventType: input.eventType,
      code: err?.code || null
    });
    return false;
  }
}

/** Fire-and-forget wrapper — does not affect capture/void control flow. */
export function recordPaymentAuditEventSafe(input: RecordPaymentAuditInput): void {
  void recordPaymentAuditEvent(input);
}

export function mapAuditDocToHistoryItem(doc: Record<string, unknown>): PaymentHistoryApiItem {
  const eventType = String(doc.eventType || '') as PaymentAuditEventType;
  const result = String(doc.result || 'failed') as PaymentAuditResult;
  const actorType = String(doc.actorType || 'system') as PaymentAuditActorType;
  const reason = doc.safeReasonCode ? String(doc.safeReasonCode) : null;
  return {
    id: String(doc._id || ''),
    eventType,
    eventTypeLabelHe: EVENT_LABEL_HE[eventType] || eventType,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as string | Date).toISOString()
      : new Date(0).toISOString(),
    paymentStatusBefore: doc.paymentStatusBefore ? String(doc.paymentStatusBefore) : null,
    paymentStatusAfter: doc.paymentStatusAfter ? String(doc.paymentStatusAfter) : null,
    result,
    resultLabelHe: RESULT_LABEL_HE[result] || result,
    actorType,
    actorTypeLabelHe: ACTOR_LABEL_HE[actorType] || actorType,
    actorDisplayName:
      actorType === 'admin' && doc.actorDisplayName ? String(doc.actorDisplayName) : null,
    safeReasonCode: reason,
    safeReasonLabelHe: reason ? REASON_LABEL_HE[reason] || reason : null
  };
}

export async function listPaymentHistoryForOrder(orderId: string): Promise<PaymentHistoryApiItem[]> {
  const docs = await PaymentAuditEvent.find({ orderId })
    .select(
      'eventType paymentStatusBefore paymentStatusAfter result actorType actorDisplayName safeReasonCode createdAt'
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return docs.map((d) => mapAuditDocToHistoryItem(d as unknown as Record<string, unknown>));
}

export function assertAuditPayloadIsSafe(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (FORBIDDEN_AUDIT_KEYS.includes(k)) found.push(p);
      walk(v, p);
    }
  };
  walk(payload, '');
  return found;
}

export {
  EVENT_LABEL_HE,
  RESULT_LABEL_HE,
  ACTOR_LABEL_HE,
  REASON_LABEL_HE,
  FORBIDDEN_AUDIT_KEYS
};
