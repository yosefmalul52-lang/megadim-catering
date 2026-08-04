import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DatePreset = 'today' | 'last7' | 'last30' | 'this_month' | 'last_month' | 'custom';
export type FunnelBucket = 'all' | 'paid' | 'pending' | 'failed_cancelled' | 'exceptions';
export type ExceptionSeverity = 'critical' | 'warning' | 'info';
export type ExceptionFilter = 'all' | ExceptionSeverity;

export type PaymentExceptionCode =
  | 'payment_failed'
  | 'stale_pending'
  | 'paid_but_deleted'
  | 'invalid_amount'
  | 'conflicting_payment_fields'
  | 'paid_missing_reference'
  | 'unknown_status'
  | 'active_capture_lock';

export interface PaymentException {
  code: PaymentExceptionCode;
  severity: ExceptionSeverity;
  labelHe: string;
  explanationHe: string;
}

export interface PaymentsSummary {
  generatedAt?: string;
  range?: { dateFrom: string | null; dateTo: string | null };
  totalReceived: number;
  paid?: { count: number; amount: number; deletedCount: number };
  captured: { count: number; amount: number };
  authorized: { count: number; amount: number };
  awaitingPayment: { count: number; amount: number };
  failed: { count: number };
  voided: { count: number };
  pending: { count: number };
  manualReview: { count: number };
  exceptions?: {
    count: number;
    tone: ExceptionSeverity | null;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  averageTransactionAmount: number;
  totalTransactions?: number;
  previousPeriod?: {
    dateFrom: string;
    dateTo: string;
    paid: { count: number; amount: number };
  } | null;
  revenueChangePercent?: number | null;
  missingFields?: string[];
  notShown?: string[];
  notes?: Record<string, string>;
}

export interface FunnelStage {
  key: FunnelBucket;
  labelHe: string;
  count: number;
  amount: number;
  percent: number;
}

export interface PaymentsFunnel {
  generatedAt: string;
  range: { dateFrom: string | null; dateTo: string | null };
  stages: FunnelStage[];
  notes?: Record<string, string>;
}

export interface RevenuePoint {
  date: string;
  amount: number;
  count: number;
}

export interface PaymentsRevenueSeries {
  generatedAt: string;
  range: { dateFrom: string | null; dateTo: string | null };
  granularity: 'day' | 'week';
  timezone: string;
  points: RevenuePoint[];
  previousPoints: RevenuePoint[] | null;
  notes?: Record<string, string>;
}

export interface PaymentListRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  paymentStatus: string;
  rawPaymentStatus: string;
  displayStatus: string;
  paymentBucket: FunnelBucket | 'unknown';
  paymentMethod: string | null;
  transactionReference: string | null;
  createdAt: string | null;
  paymentAt: string | null;
  orderType: string | null;
  fulfillment: 'delivery' | 'pickup' | 'unknown';
  requiresManualReview: boolean;
  hasException: boolean;
  primaryException: PaymentException | null;
  exceptionCodes: PaymentExceptionCode[];
  canCapture: boolean;
  canVoid: boolean;
  canRefund: boolean;
  isOrderDeleted?: boolean;
}

export interface PaymentHistoryItem {
  id: string;
  eventType: string;
  eventTypeLabelHe: string;
  createdAt: string;
  paymentStatusBefore: string | null;
  paymentStatusAfter: string | null;
  result: 'success' | 'failed' | 'blocked' | 'unknown';
  resultLabelHe: string;
  actorType: 'customer' | 'guest' | 'admin' | 'system';
  actorTypeLabelHe: string;
  actorDisplayName: string | null;
  safeReasonCode: string | null;
  safeReasonLabelHe: string | null;
}

export interface PaymentDetail extends PaymentListRow {
  exceptions?: PaymentException[];
  operationalStatus: string | null;
  authorizedAmount: number | null;
  subtotal: number | null;
  deliveryFee: number | null;
  cateringKind: string | null;
  eventType: string | null;
  guestCount: number | null;
  venue: string | null;
  mealTime?: string | null;
  mealTypes?: string[] | null;
  adminNotes?: string | null;
  numberOfPortions?: number | null;
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
    address: string | null;
    deliveryType: string;
    notes: string | null;
    eventDate?: string | null;
  };
  items: Array<{ name: string; quantity: number; price: number; category?: string }>;
  paymentHistory?: PaymentHistoryItem[];
  timeline: Array<{ key: string; label: string; at: string | null }>;
  historySource?: 'audit' | 'fallback_timeline';
  hasCaptureLock: boolean;
  orderAdminPath?: string;
}

export interface PaymentsListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExceptionsListMeta {
  total: number;
  limit: number;
  refinedFrom: number;
}

export interface PaymentsListParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  preset?: DatePreset;
  paymentStatus?: string;
  search?: string;
  orderType?: string;
  fulfillment?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Default true — include soft-deleted orders with payment signals. */
  includeDeletedPayments?: boolean;
  funnelBucket?: FunnelBucket;
  exceptionFilter?: ExceptionFilter;
  /** Accounting export: full range dump including archived past orders. */
  forExport?: boolean | string;
  dateBasis?: 'createdAt' | 'activity';
}

@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/payments`;

  private toParams(params: PaymentsListParams): HttpParams {
    let p = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      p = p.set(key, String(value));
    }
    return p;
  }

  getSummary(params: PaymentsListParams = {}): Observable<{ success: boolean; data: PaymentsSummary }> {
    return this.http.get<{ success: boolean; data: PaymentsSummary }>(`${this.base}/summary`, {
      params: this.toParams(params)
    });
  }

  getFunnel(params: PaymentsListParams = {}): Observable<{ success: boolean; data: PaymentsFunnel }> {
    return this.http.get<{ success: boolean; data: PaymentsFunnel }>(`${this.base}/funnel`, {
      params: this.toParams(params)
    });
  }

  getRevenueSeries(
    params: PaymentsListParams = {}
  ): Observable<{ success: boolean; data: PaymentsRevenueSeries }> {
    return this.http.get<{ success: boolean; data: PaymentsRevenueSeries }>(
      `${this.base}/revenue-series`,
      { params: this.toParams(params) }
    );
  }

  listExceptions(params: PaymentsListParams = {}): Observable<{
    success: boolean;
    data: PaymentListRow[];
    meta: ExceptionsListMeta;
  }> {
    return this.http.get<{ success: boolean; data: PaymentListRow[]; meta: ExceptionsListMeta }>(
      `${this.base}/exceptions`,
      { params: this.toParams(params) }
    );
  }

  list(params: PaymentsListParams = {}): Observable<{
    success: boolean;
    data: PaymentListRow[];
    meta: PaymentsListMeta;
  }> {
    return this.http.get<{ success: boolean; data: PaymentListRow[]; meta: PaymentsListMeta }>(
      this.base,
      { params: this.toParams(params) }
    );
  }

  getDetail(orderId: string): Observable<{ success: boolean; data: PaymentDetail }> {
    return this.http.get<{ success: boolean; data: PaymentDetail }>(`${this.base}/${orderId}`);
  }

  exportCsv(params: PaymentsListParams = {}): Observable<Blob> {
    return this.http.get(`${this.base}/export.csv`, {
      params: this.toParams(params),
      responseType: 'blob'
    });
  }
}
