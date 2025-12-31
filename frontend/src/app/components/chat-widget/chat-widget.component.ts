import { AfterViewInit, Component, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// ChatKit global type (loaded dynamically)
declare global {
  interface Window {
    ChatKit?: any;
  }
}

interface CateringInquiryArgs {
  fullName: string;
  phone: string;
  email: string;
  eventDate: string;   // YYYY-MM-DD
  eventTime: string;   // HH:MM
  guestCount: number;  // integer >= 1
  location?: string;
  kashrut?: string;
  budgetRange?: string;
  notes?: string;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Fallback minimal widget is rendered only if ChatKit failed to load -->
    <div 
      *ngIf="fallbackActive"
      style="position: fixed; left: 16px; bottom: 16px; z-index: 9999; direction: rtl; font-family: inherit;"
    >
      <button 
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="isOpen"
        style="background:#0E1A24;color:#fff;border:none;border-radius:24px;padding:12px 16px;box-shadow:0 6px 16px rgba(0,0,0,0.25);cursor:pointer;"
      >
        {{ isOpen ? 'סגור עוזר' : 'עוזר מגדים' }}
      </button>

      <div 
        *ngIf="isOpen"
        style="margin-top:8px;width:340px;max-width:92vw;background:#fff;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,0.2);padding:12px;display:flex;flex-direction:column;"
      >
        <div style="font-weight:700;color:#0E1A24;margin-bottom:6px;">Magadim Catering Assistant</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">מצב גיבוי פעיל (CDN לא זמין) — צ׳אט בסיסי דרך השרת.</div>

        <div style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;padding:6px;border:1px solid #eee;border-radius:8px;max-height:300px;">
          <div *ngFor="let m of messages" [style.alignSelf]="m.isBot ? 'flex-start' : 'flex-end'"
               [style.background]="m.isBot ? '#f2f6f9' : '#cbb69e'" 
               [style.color]="m.isBot ? '#0E1A24' : '#0E1A24'"
               style="border-radius:10px;padding:8px 10px;max-width:80%;word-break:break-word;">
            {{ m.text }}
          </div>
        </div>

        <form (submit)="sendMessage($event)" style="display:flex;gap:8px;margin-top:8px;align-items:center;">
          <input type="text" [(ngModel)]="userMessage" name="message" placeholder="כתוב הודעה..." 
                 style="flex:1;border:1px solid #ddd;border-radius:8px;padding:8px;" />
          <button type="submit" [disabled]="sending" 
                  style="background:#0E1A24;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;">
            {{ sending ? 'שולח…' : 'שלח' }}
          </button>
        </form>
        <div *ngIf="errorMsg" style="color:#b00020;font-size:12px;margin-top:6px;">{{ errorMsg }}</div>
      </div>
    </div>
  `,
})
export class ChatWidgetComponent implements AfterViewInit, OnDestroy {
  private scriptEl: HTMLScriptElement | null = null;
  private widgetInstance: any | null = null;
  private mountRetryHandle: number | null = null;
  private cdr = inject(ChangeDetectorRef);

  // Fallback minimal widget state
  fallbackActive = false;
  isOpen = false;
  sending = false;
  errorMsg = '';
  messages: Array<{ text: string; isBot: boolean }> = [
    { text: 'שלום! איך אפשר לעזור? אפשר לשאול על התפריט, הכשרות או לבקש הצעת מחיר/טעימות.', isBot: true }
  ];
  userMessage = '';
  private http = inject(HttpClient);
  private conversationId = '';

  ngAfterViewInit(): void {
    // Persistent conversation id for summaries
    const key = 'magadim_conversation_id';
    let cid: string | null = localStorage.getItem(key);
    if (!cid) {
      const generated: string = (crypto as any).randomUUID?.() || `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      localStorage.setItem(key, generated);
      cid = generated;
    }
    this.conversationId = cid as string;

    if (environment.assistant && (environment.assistant as any).chatKitEnabled === false) {
      // Explicitly disabled via environment -> use fallback chat
      setTimeout(() => {
        this.fallbackActive = true;
        this.cdr.detectChanges();
      }, 0);
      return;
    }

    this.injectChatKitScript()
      .then(() => {
        // Try immediate mount, and also schedule a retry shortly in case the module initializes a bit later
        this.mountWidget();
        this.scheduleRetry();
      })
      .catch((err) => console.error('[ChatWidget] Failed loading ChatKit script:', err));
  }

  ngOnDestroy(): void {
    try {
      if (this.widgetInstance && typeof this.widgetInstance.destroy === 'function') {
        this.widgetInstance.destroy();
      }
    } catch {}
    if (this.mountRetryHandle) {
      window.clearTimeout(this.mountRetryHandle);
      this.mountRetryHandle = null;
    }
    if (this.scriptEl && this.scriptEl.parentNode) {
      this.scriptEl.parentNode.removeChild(this.scriptEl);
    }
    this.scriptEl = null;
    this.widgetInstance = null;
  }

  private injectChatKitScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.ChatKit) {
        console.debug('[ChatWidget] ChatKit already present on window');
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://cdn.platform.openai.com/chatkit/bundles/chatkit-latest.min.js';
      script.onload = () => {
        console.debug('[ChatWidget] ChatKit script loaded');
        resolve();
      };
      script.onerror = (e) => {
        console.error('[ChatWidget] ChatKit script failed to load', e);
        // Activate fallback minimal widget if CDN is unavailable
        setTimeout(() => {
          this.fallbackActive = true;
          this.cdr.detectChanges();
        }, 0);
        resolve();
      };
      document.head.appendChild(script);
      this.scriptEl = script;
    });
  }

  private mountWidget(): void {
    if (!window.ChatKit) {
      console.debug('[ChatWidget] ChatKit not yet available, will retry...');
      return;
    }
    if (this.widgetInstance) {
      return; // Already mounted
    }

    const tools = {
      create_catering_inquiry: {
        description: 'יוצר פניה ראשונית לקייטרינג “מגדים” לתיאום טעימות/הצעת מחיר',
        parameters: {
          type: 'object',
          properties: {
            fullName:   { type: 'string' },
            phone:      { type: 'string' },
            email:      { type: 'string' },
            eventDate:  { type: 'string' },
            eventTime:  { type: 'string' },
            guestCount: { type: 'number' },
            location:   { type: 'string' },
            kashrut:    { type: 'string' },
            budgetRange:{ type: 'string' },
            notes:      { type: 'string' },
          },
          required: ['fullName','phone','email','eventDate','eventTime','guestCount'],
        },
        onCall: async (args: CateringInquiryArgs) => {
          const res = await fetch(`${environment.apiBase}/api/catering-inquiry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
          });
          const json = await res.json();
          return json;
        },
      },
    } as const;

    this.widgetInstance = window.ChatKit.mount({
      container: document.body,
      position: 'bottom-left',
      title: 'Magadim Catering Assistant',
      theme: { direction: 'rtl' },
      welcome: 'שלום! איך אוכל לעזור? אפשר לשאול על התפריט, הכשרות, או לבקש הצעת מחיר/טעימות.',
      system_prompt: environment.assistant.systemPrompt,
      tools,
    });
    console.debug('[ChatWidget] ChatKit widget mounted');
  }

  private scheduleRetry(): void {
    this.mountRetryHandle = window.setTimeout(() => {
      this.mountWidget();
    }, 1200);
  }

  // Fallback UI helpers
  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMsg = '';
    const msg = (this.userMessage || '').trim();
    if (!msg || this.sending) return;
    this.userMessage = '';
    this.messages.push({ text: msg, isBot: false });
    this.sending = true;
    try {
      // Build minimal message history for /api/chat
      const history = this.messages.map(m => ({ role: m.isBot ? 'assistant' : 'user', content: m.text }));
      const res = await this.http.post<any>(`${environment.apiBase}/api/chat`, {
        conversationId: this.conversationId,
        systemPrompt: environment.assistant.systemPrompt,
        messages: history,
      }).toPromise();
      if (!res || res.ok === false) {
        this.errorMsg = res?.error || 'שגיאה בעיבוד ההודעה';
        return;
      }
      const reply = res.reply || 'מצטערים, לא התקבלה תשובה.';
      this.messages.push({ text: reply, isBot: true });
    } catch (e) {
      this.errorMsg = 'שגיאת רשת — ודא שהשרת על 8787 פעיל';
    } finally {
      this.sending = false;
    }
  }
}


