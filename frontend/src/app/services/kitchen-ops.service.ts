import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type KitchenOpsView = 'today' | 'fulfillment' | 'event' | 'changes';

@Injectable({ providedIn: 'root' })
export class KitchenOpsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/kitchen`;

  getOpsReport(params: Record<string, string | boolean | undefined>): Observable<any> {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '' || v === false) continue;
      q[k] = String(v);
    }
    return this.http.get<{ success: boolean; report: any }>(`${this.base}/ops-report`, { params: q }).pipe(
      map((r) => r.report)
    );
  }

  exportOps(format: string, params: Record<string, string | boolean | undefined>): Observable<Blob | string> {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '' || v === false) continue;
      q[k] = String(v);
    }
    if (format === 'print') {
      return this.http.get(`${this.base}/ops-report/export/print`, { params: q, responseType: 'text' });
    }
    return this.http.get(`${this.base}/ops-report/export/${format}`, { params: q, responseType: 'blob' });
  }

  createTask(body: any): Observable<any> {
    return this.http.post<{ success: boolean; data: any }>(`${this.base}/tasks`, body).pipe(map((r) => r.data));
  }

  updateTask(id: string, body: any): Observable<any> {
    return this.http.patch<{ success: boolean; data: any }>(`${this.base}/tasks/${id}`, body).pipe(map((r) => r.data));
  }

  taskAction(
    id: string,
    body: { action: string; version: number; payload?: any },
    idempotencyKey?: string
  ): Observable<any> {
    let headers = new HttpHeaders();
    if (idempotencyKey) headers = headers.set('Idempotency-Key', idempotencyKey);
    return this.http
      .post<{ success: boolean; data: any }>(`${this.base}/tasks/${id}/actions`, body, { headers })
      .pipe(map((r) => r.data));
  }

  bulkActions(body: any): Observable<any> {
    return this.http.post(`${this.base}/tasks/bulk-actions`, body);
  }

  buildPlan(body: any): Observable<any> {
    return this.http.post<{ success: boolean; data: any }>(`${this.base}/plans`, body).pipe(map((r) => r.data));
  }

  syncReview(orderId: string, body: any): Observable<any> {
    return this.http
      .post<{ success: boolean; data: any }>(`${this.base}/orders/${orderId}/sync-review`, body)
      .pipe(map((r) => r.data));
  }

  backfill(body: any): Observable<any> {
    return this.http.post<{ success: boolean; data: any }>(`${this.base}/backfill`, body).pipe(map((r) => r.data));
  }

  listStations(): Observable<any[]> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.base}/stations`).pipe(map((r) => r.data || []));
  }

  saveStation(body: any, id?: string): Observable<any> {
    if (id) {
      return this.http
        .patch<{ success: boolean; data: any }>(`${this.base}/stations/${id}`, body)
        .pipe(map((r) => r.data));
    }
    return this.http.post<{ success: boolean; data: any }>(`${this.base}/stations`, body).pipe(map((r) => r.data));
  }

  listTemplates(): Observable<any[]> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.base}/templates`).pipe(map((r) => r.data || []));
  }

  saveTemplate(body: any, id?: string): Observable<any> {
    if (id) {
      return this.http
        .patch<{ success: boolean; data: any }>(`${this.base}/templates/${id}`, body)
        .pipe(map((r) => r.data));
    }
    return this.http.post<{ success: boolean; data: any }>(`${this.base}/templates`, body).pipe(map((r) => r.data));
  }

  getPrepDayReport(params: { day: string; orderKind?: string }): Observable<any> {
    const q: Record<string, string> = { day: params.day };
    if (params.orderKind) q['orderKind'] = params.orderKind;
    return this.http
      .get<{ success: boolean; data: any }>(`${this.base}/prep-day`, { params: q })
      .pipe(map((r) => r.data));
  }

  upsertPrepAssignment(body: any): Observable<any> {
    return this.http
      .post<{ success: boolean; data: any }>(`${this.base}/prep-assignments`, body)
      .pipe(map((r) => r.data));
  }

  splitPrepAssignment(body: any): Observable<any> {
    return this.http
      .post<{ success: boolean; data: any }>(`${this.base}/prep-assignments/split`, body)
      .pipe(map((r) => r.data));
  }

  listOrderPrepAssignments(orderId: string): Observable<any[]> {
    return this.http
      .get<{ success: boolean; data: any[] }>(`${this.base}/orders/${orderId}/prep-assignments`)
      .pipe(map((r) => r.data || []));
  }
}
