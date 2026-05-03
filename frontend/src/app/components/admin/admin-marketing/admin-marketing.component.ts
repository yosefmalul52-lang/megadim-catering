import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import { AdminContactsService, LeadsBySourcePoint } from '../../../services/admin-contacts.service';
import { OrderService, RevenueBySourcePoint } from '../../../services/order.service';
import {
  CampaignItem,
  CampaignPlatform,
  CampaignService,
  CampaignStatus
} from '../../../services/campaign.service';
import { ToastService } from '../../../services/toast.service';

Chart.register(...registerables);

type MarketingTab = 'leads' | 'orders';

/** מצבי תצוגה בתוך מוקאפ הפלאפון */
export type PreviewMode = 'story' | 'feed11' | 'feed45';

/** פוסט מוכן לשיווק — עריכה ידנית של המערך לפי צורך */
export interface ReadyPost {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  label?: string;
}

@Component({
  selector: 'app-admin-marketing',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, BaseChartDirective],
  templateUrl: './admin-marketing.component.html',
  styleUrls: ['./admin-marketing.component.scss']
})
export class AdminMarketingComponent implements OnInit {
  private contactsService = inject(AdminContactsService);
  private orderService = inject(OrderService);
  private campaignService = inject(CampaignService);
  private toast = inject(ToastService);

  isLoading = true;
  activeTab: MarketingTab = 'leads';

  leadsBySource: LeadsBySourcePoint[] = [];
  revenueBySource: RevenueBySourcePoint[] = [];

  leadsChartData: ChartData<'bar'> = { labels: [], datasets: [{ data: [], label: 'לידים' }] };
  leadsChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b' } },
      y: { ticks: { color: '#64748b' } }
    }
  };

  revenueChartData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };
  revenueChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, color: '#334155' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = Number(ctx.parsed || 0);
            return `${ctx.label}: ₪${value.toLocaleString('he-IL')}`;
          }
        }
      }
    }
  };

  campaignTitle = '';
  campaignContent = '';
  campaignMediaUrl = '';
  campaignScheduledAt = '';
  selectedPlatforms: CampaignPlatform[] = ['facebook'];
  isLaunching = false;
  campaigns: CampaignItem[] = [];
  isLoadingCampaigns = false;
  launchError = '';
  launchSuccessMessage = '';

  /** מצב תצוגה בתוך הפלאפון */
  previewMode: PreviewMode = 'feed45';

  /** תבניות פוסטים מוכנים (מקור) — עריכה כאן; הרצועה לגרירה מתאפסת אחרי כל שחרור */
  private readonly readyPostsTemplate: ReadyPost[] = [
    {
      id: 'sample-shabbat',
      label: 'שבת',
      title: 'שבת שלווה עם מגדים',
      content: 'הזמינו עכשיו את תפריט השבת שלנו.\nhttps://example.com/menu',
      mediaUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80'
    },
    {
      id: 'sample-event',
      label: 'אירוע',
      title: 'קייטרינג לאירועים',
      content: 'חוויית אירוח מלאה לכל אירוע.\nhttps://example.com/events',
      mediaUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=80'
    },
    {
      id: 'sample-text-only',
      label: 'טקסט בלבד',
      title: 'מבצע לזמן מוגבל',
      content: 'הנחה על הזמנות עד סוף החודש.\nhttps://example.com/order'
    }
  ];

  /** עותק לרשימת CDK — מתאפס אחרי גרירה לפלאפון כדי שלא ייעלמו תבניות */
  readyPostStrip: ReadyPost[] = [];

  /** מערך זמני ל־cdkDropList במסך הפלאפון (ריק; משמש לקבלת drop בלי להעביר את הפוסט מהרשימה) */
  phoneScratch: ReadyPost[] = [];

  /** הדגשת אזור שחרור בזמן גרירה */
  phoneDropActive = false;

  ngOnInit(): void {
    this.resetReadyPostStrip();
    this.loadData();
    this.loadCampaigns();
  }

  private resetReadyPostStrip(): void {
    this.readyPostStrip = this.readyPostsTemplate.map((p) => ({ ...p }));
  }

  setTab(tab: MarketingTab): void {
    this.activeTab = tab;
  }

  get hasLeadsData(): boolean {
    return this.leadsBySource.length > 0;
  }

  get hasRevenueData(): boolean {
    return this.revenueBySource.length > 0;
  }

  get totalLeads(): number {
    return this.leadsBySource.reduce((sum, row) => sum + (row.leadsCount || 0), 0);
  }

  get totalRevenue(): number {
    return this.revenueBySource.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
  }

  private loadData(): void {
    this.isLoading = true;
    forkJoin({
      leads: this.contactsService.getLeadsBySource(),
      revenue: this.orderService.getRevenueBySource()
    }).subscribe({
      next: ({ leads, revenue }) => {
        this.leadsBySource = (leads || []).filter((r) => Number(r.leadsCount) > 0);
        this.revenueBySource = (revenue || []).filter((r) => Number(r.totalRevenue) > 0);
        this.buildLeadsChart();
        this.buildRevenueChart();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading marketing hub data:', err);
        this.leadsBySource = [];
        this.revenueBySource = [];
        this.buildLeadsChart();
        this.buildRevenueChart();
        this.isLoading = false;
      }
    });
  }

  launchCampaign(): void {
    const title = this.campaignTitle.trim();
    const content = this.campaignContent.trim();
    const mediaUrl = this.campaignMediaUrl.trim();
    const platforms = this.selectedPlatforms;
    const scheduledAt = this.campaignScheduledAt ? new Date(this.campaignScheduledAt) : null;

    this.launchError = '';
    this.launchSuccessMessage = '';

    if (!title) {
      this.toast.error('יש להזין כותרת קמפיין');
      return;
    }
    if (!content) {
      this.toast.error('יש להזין תוכן קמפיין');
      return;
    }
    if (platforms.length === 0) {
      this.toast.error('יש לבחור לפחות פלטפורמה אחת');
      return;
    }
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      this.toast.error('תאריך תזמון לא תקין');
      return;
    }

    this.isLaunching = true;
    this.campaignService
      .launchCampaign({
        title,
        content,
        ...(mediaUrl ? { mediaUrl } : {}),
        platforms,
        ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {})
      })
      .subscribe({
        next: (res) => {
          this.isLaunching = false;
          this.toast.success('הקמפיין שוגר בהצלחה');
          this.launchSuccessMessage = 'הקמפיין נשמר ונשלח בהצלחה.';
          this.campaignTitle = '';
          this.campaignContent = '';
          this.campaignMediaUrl = '';
          this.campaignScheduledAt = '';
          this.selectedPlatforms = ['facebook'];
          this.loadCampaigns();
        },
        error: (err) => {
          this.isLaunching = false;
          const message = err?.error?.message || 'שגיאה בשיגור הקמפיין';
          const details =
            err?.error?.data?.n8nResponse?.error ||
            err?.error?.data?.n8nResponse?.statusText ||
            '';
          this.launchError = details ? `${message} - ${details}` : message;
          this.toast.error(message);
          this.loadCampaigns();
        }
      });
  }

  loadCampaigns(): void {
    this.isLoadingCampaigns = true;
    this.campaignService.getCampaigns({ limit: 20 }).subscribe({
      next: (res) => {
        this.campaigns = res?.data || [];
        this.isLoadingCampaigns = false;
      },
      error: () => {
        this.campaigns = [];
        this.isLoadingCampaigns = false;
      }
    });
  }

  togglePlatform(platform: CampaignPlatform): void {
    if (this.selectedPlatforms.includes(platform)) {
      this.selectedPlatforms = this.selectedPlatforms.filter((p) => p !== platform);
      return;
    }
    this.selectedPlatforms = [...this.selectedPlatforms, platform];
  }

  isPlatformSelected(platform: CampaignPlatform): boolean {
    return this.selectedPlatforms.includes(platform);
  }

  get selectedPlatformsLabel(): string {
    if (!this.selectedPlatforms.length) return 'לא נבחרו פלטפורמות';
    return this.selectedPlatforms
      .map((p) => (p === 'facebook' ? 'Facebook' : 'Instagram'))
      .join(' + ');
  }

  get campaignPreviewText(): string {
    return this.campaignContent.trim() || 'תצוגה מקדימה של הפוסט תופיע כאן...';
  }

  setPreviewMode(mode: PreviewMode): void {
    this.previewMode = mode;
  }

  get previewModeLabel(): string {
    const map: Record<PreviewMode, string> = {
      story: 'סטורי / סטטוס (9:16)',
      feed11: 'פיד 1:1',
      feed45: 'פיד 4:5'
    };
    return map[this.previewMode];
  }

  get viewportAspectClass(): string {
    return `aspect-${this.previewMode}`;
  }

  applyReadyPost(post: ReadyPost): void {
    this.campaignTitle = post.title;
    this.campaignContent = post.content;
    this.campaignMediaUrl = post.mediaUrl?.trim() || '';
    this.toast.success('הוחל פוסט מוכן');
  }

  onPhoneDrop(event: CdkDragDrop<ReadyPost[]>): void {
    this.phoneDropActive = false;
    if (event.previousContainer === event.container) {
      return;
    }
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    const post = event.item.data as ReadyPost | undefined;
    if (post) {
      this.applyReadyPost(post);
    }
    this.phoneScratch.length = 0;
    this.resetReadyPostStrip();
  }

  onReadyStripDrop(event: CdkDragDrop<ReadyPost[]>): void {
    this.phoneDropActive = false;
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.phoneScratch.length = 0;
  }

  onPhoneDragEnter(): void {
    this.phoneDropActive = true;
  }

  onPhoneDragLeave(): void {
    this.phoneDropActive = false;
  }

  isImageUrl(url: string | undefined): boolean {
    if (!url?.trim()) return false;
    const lower = url.trim().split('?')[0].toLowerCase();
    return /\.(jpe?g|png|gif|webp)$/i.test(lower);
  }

  get canLaunchCampaign(): boolean {
    return !this.isLaunching && !!this.campaignTitle.trim() && !!this.campaignContent.trim() && this.selectedPlatforms.length > 0;
  }

  getStatusLabel(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      draft: 'טיוטה',
      pending: 'ממתין לשיגור',
      published: 'פורסם',
      failed: 'נכשל'
    };
    return map[status] || status;
  }

  getStatusClass(status: CampaignStatus): string {
    return `status-${status}`;
  }

  getCampaignResponseSummary(campaign: CampaignItem): string {
    if (!campaign.n8nResponse) return '-';
    if (campaign.n8nResponse['error']) return String(campaign.n8nResponse['error']);
    if (campaign.n8nResponse['statusText']) return String(campaign.n8nResponse['statusText']);
    if (campaign.n8nResponse['message']) return String(campaign.n8nResponse['message']);
    return 'התקבלה תגובה';
  }

  private buildLeadsChart(): void {
    const labels = this.leadsBySource.map((r) => r.source || 'direct');
    const values = this.leadsBySource.map((r) => r.leadsCount || 0);
    this.leadsChartData = {
      labels,
      datasets: [
        {
          label: 'לידים',
          data: values,
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          maxBarThickness: 44
        }
      ]
    };
  }

  private buildRevenueChart(): void {
    const labels = this.revenueBySource.map((r) => r.source || 'direct');
    const values = this.revenueBySource.map((r) => r.totalRevenue || 0);
    this.revenueChartData = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => this.palette(i)),
          borderColor: '#ffffff',
          borderWidth: 2
        }
      ]
    };
  }

  private palette(index: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899'];
    return colors[index % colors.length];
  }
}
