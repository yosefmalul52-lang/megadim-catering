import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import { AdminContactsService, LeadsBySourcePoint } from '../../../services/admin-contacts.service';
import { OrderService, RevenueBySourcePoint } from '../../../services/order.service';
import { CouponService, Coupon } from '../../../services/coupon.service';
import { CampaignService, CampaignAudience } from '../../../services/campaign.service';
import { ToastService } from '../../../services/toast.service';

Chart.register(...registerables);

type MarketingTab = 'leads' | 'orders';

@Component({
  selector: 'app-admin-marketing',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './admin-marketing.component.html',
  styleUrls: ['./admin-marketing.component.scss']
})
export class AdminMarketingComponent implements OnInit {
  private contactsService = inject(AdminContactsService);
  private orderService = inject(OrderService);
  private couponService = inject(CouponService);
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

  campaignMessage = '';
  campaignAudience: CampaignAudience = 'vip';
  campaignChannels: { whatsapp: boolean; email: boolean } = { whatsapp: true, email: false };
  selectedCouponCode = '';
  coupons: Coupon[] = [];
  isLaunching = false;

  ngOnInit(): void {
    this.loadData();
    this.loadCoupons();
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

  private loadCoupons(): void {
    this.couponService.getCoupons().subscribe({
      next: (list) => {
        this.coupons = (list || []).filter((c) => c.isActive);
      },
      error: (err) => {
        console.error('Error loading coupons for campaign launcher:', err);
        this.coupons = [];
      }
    });
  }

  launchCampaign(): void {
    const message = this.campaignMessage.trim();
    const channels = [
      ...(this.campaignChannels.whatsapp ? ['whatsapp'] : []),
      ...(this.campaignChannels.email ? ['email'] : [])
    ];

    if (!message) {
      this.toast.error('יש להזין תוכן קמפיין');
      return;
    }
    if (channels.length === 0) {
      this.toast.error('יש לבחור לפחות ערוץ אחד');
      return;
    }

    this.isLaunching = true;
    this.campaignService
      .launchCampaign({
        message,
        audience: this.campaignAudience,
        channels,
        ...(this.selectedCouponCode ? { couponCode: this.selectedCouponCode } : {})
      })
      .subscribe({
        next: (res) => {
          this.isLaunching = false;
          const count = res?.data?.targetsCount ?? 0;
          this.toast.success(`הקמפיין שוגר בהצלחה (${count} נמענים)`);
          this.campaignMessage = '';
          this.selectedCouponCode = '';
        },
        error: (err) => {
          this.isLaunching = false;
          this.toast.error(err?.error?.message || 'שגיאה בשיגור הקמפיין');
        }
      });
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
