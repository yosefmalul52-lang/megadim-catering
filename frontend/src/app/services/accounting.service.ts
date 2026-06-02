import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AccountingSummary {
  grandTotal:    number;
  onlineTotal:   number;
  externalTotal: number;
  breakdown: Array<{
    month:    string; // YYYY-MM
    online:   number;
    external: number;
    total:    number;
  }>;
}

export interface TransactionItem {
  id:          string;
  date:        string;
  clientName:  string;
  source:      'online' | 'external';
  amount:      number;
  fileUrl?:    string;
  orderId?:    string;
  invoiceNum?: string;
}

export interface TransactionsMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface TransactionsResponse {
  success: boolean;
  data:    TransactionItem[];
  meta:    TransactionsMeta;
}

export interface ExternalInvoicePayload {
  clientName:     string;
  amount:         number;
  issueDate:      string;
  description?:   string;
  invoiceNumber?: string;
  fileUrl?:       string;
  fileKey?:       string;
}

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/accounting`;

  getSummary(): Observable<{ success: boolean; data: AccountingSummary }> {
    return this.http.get<{ success: boolean; data: AccountingSummary }>(`${this.base}/summary`);
  }

  getTransactions(params: {
    page?:     number;
    limit?:    number;
    source?:   'online' | 'external' | '';
    dateFrom?: string;
    dateTo?:   string;
  }): Observable<TransactionsResponse> {
    let p = new HttpParams();
    if (params.page)     p = p.set('page',     String(params.page));
    if (params.limit)    p = p.set('limit',    String(params.limit));
    if (params.source)   p = p.set('source',   params.source);
    if (params.dateFrom) p = p.set('dateFrom', params.dateFrom);
    if (params.dateTo)   p = p.set('dateTo',   params.dateTo);
    return this.http.get<TransactionsResponse>(`${this.base}/transactions`, { params: p });
  }

  createExternal(payload: ExternalInvoicePayload): Observable<{ success: boolean; data: unknown }> {
    return this.http.post<{ success: boolean; data: unknown }>(`${this.base}/external`, payload);
  }

  uploadDocument(file: File): Observable<{ success: boolean; fileUrl: string; fileKey: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ success: boolean; fileUrl: string; fileKey: string }>(
      `${this.base}/upload`, fd
    );
  }
}
