import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

interface ChatSummaryRecord {
  conversationId: string;
  title: string;
  bullets: string[];
  userIntent: string;
  extracted?: {
    fullName?: string;
    phone?: string;
    email?: string;
    eventDate?: string;
    eventTime?: string;
    guestCount?: number;
    location?: string;
    kashrut?: string;
    budgetRange?: string;
  };
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  startedAt?: string;
  updatedAt?: string;
}

// Development-only key; replace with proper auth for production
const ADMIN_KEY = 'dev_admin_key_change_me';

@Component({
  selector: 'app-chat-summaries',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding:16px;direction:rtl;">
      <h2 style="margin-bottom:12px;">סיכומי שיחות</h2>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
        <input [(ngModel)]="query" placeholder="חיפוש בכותרת" style="padding:8px;border:1px solid #ddd;border-radius:8px;" />
        <select [(ngModel)]="intent" style="padding:8px;border:1px solid #ddd;border-radius:8px;">
          <option value="">כל הסוגים</option>
          <option>הצעת מחיר</option>
          <option>טעימות</option>
          <option>שאלות כלליות</option>
          <option>בירור כשרות</option>
          <option>אחר</option>
        </select>
      </div>

      <div *ngIf="error" style="color:#b00020;margin-bottom:8px;">{{ error }}</div>

      <div *ngFor="let s of filtered()" style="background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <div>
            <div style="font-weight:700;color:#0E1A24;">{{ s.title || ('שיחה ' + s.conversationId) }}</div>
            <div style="font-size:12px;color:#666;">עודכן: {{ s.updatedAt || '-' }}</div>
          </div>
          <div style="text-align:left;font-size:12px;color:#333;">
            {{ s.userIntent || 'אחר' }} | {{ s.extracted?.guestCount || '-' }} אורחים | {{ s.extracted?.eventDate || '-' }} | {{ s.extracted?.location || '-' }}
          </div>
        </div>
        <div *ngIf="s.bullets?.length" style="margin-top:8px;">
          <ul>
            <li *ngFor="let b of s.bullets">{{ b }}</li>
          </ul>
        </div>
        <details style="margin-top:6px;">
          <summary>פרטים</summary>
          <div style="margin-top:6px;font-size:13px;">
            <div><b>איש קשר:</b> {{ s.extracted?.fullName || '-' }} | {{ s.extracted?.phone || '-' }} | {{ s.extracted?.email || '-' }}</div>
            <div><b>הודעת משתמש אחרונה:</b> {{ s.lastUserMessage || '-' }}</div>
            <div><b>הודעת עוזר אחרונה:</b> {{ s.lastAssistantMessage || '-' }}</div>
            <div><b>התחיל:</b> {{ s.startedAt || '-' }}</div>
          </div>
        </details>
      </div>
    </div>
  `,
})
export class ChatSummariesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  items: ChatSummaryRecord[] = [];
  error = '';
  query = '';
  intent = '';
  private es?: EventSource;

  ngOnInit(): void {
    this.fetch();
    this.listen();
  }

  ngOnDestroy(): void {
    this.es?.close();
  }

  filtered(): ChatSummaryRecord[] {
    const q = this.query.trim();
    return this.items
      .filter(s => !this.intent || s.userIntent === this.intent)
      .filter(s => !q || (s.title || '').includes(q))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  private fetch(): void {
    this.http.get<{ ok: boolean; data: ChatSummaryRecord[] }>(`${environment.apiUrl}/admin/summaries?key=${encodeURIComponent(ADMIN_KEY)}`)
      .subscribe({
        next: (r) => {
          if (r.ok) this.items = r.data || [];
          else this.error = 'שגיאה בטעינת סיכומים';
        },
        error: () => {
          this.error = 'שגיאת רשת בטעינת סיכומים';
        }
      });
  }

  private listen(): void {
    const url = `${environment.apiUrl}/admin/stream?key=${encodeURIComponent(ADMIN_KEY)}`;
    this.es = new EventSource(url);
    this.es.addEventListener('summary', (ev: MessageEvent) => {
      try {
        const s = JSON.parse(ev.data) as ChatSummaryRecord;
        const idx = this.items.findIndex(x => x.conversationId === s.conversationId);
        if (idx >= 0) this.items[idx] = s; else this.items.unshift(s);
        this.items = [...this.items];
      } catch {}
    });
  }
}


