import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminDashboardComponent } from './dashboard.component';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { DashboardOverviewData } from '../../../utils/dashboard-overview.util';

function sampleOverview(overrides: Partial<DashboardOverviewData> = {}): DashboardOverviewData {
  return {
    range: {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.000Z',
      timezone: 'Asia/Jerusalem',
      dateBasis: 'createdAt',
      preset: 'month',
      previous: { from: 'a', to: 'b' }
    },
    kpis: {
      capturedRevenue: { value: 1000, previousValue: 500, changePercent: 100 },
      paidOrders: { value: 10, previousValue: 5, changePercent: 100 },
      averageOrderValue: { value: 100, previousValue: 100, changePercent: 0 },
      totalOrders: { value: 12, previousValue: 8, changePercent: 50 },
      activeOrders: { value: 3, previousValue: 2, changePercent: 50 },
      returningCustomers: { value: 2, previousValue: 1, changePercent: 100 }
    },
    paymentAlerts: { awaiting: 1, failed: 0, items: [] },
    trend: [
      { period: '2026-08-01', revenue: 0, paidOrdersCount: 0, averageOrderValue: 0 },
      { period: '2026-08-02', revenue: 200, paidOrdersCount: 2, averageOrderValue: 100 }
    ],
    ordersByStatus: [],
    ordersByType: [],
    topItems: [{ name: 'חלות', quantity: 4, revenue: 80 }],
    topSellingByCategory: [
      {
        category: 'סלטים',
        items: [
          { name: 'חומוס', quantity: 10, revenue: 100 },
          { name: 'טחינה', quantity: 8, revenue: 80 },
          { name: 'קולסלאו', quantity: 6, revenue: 60 }
        ]
      }
    ],
    actionItems: [
      {
        id: '1',
        type: 'payment_failed',
        severity: 'critical',
        title: 'תשלום נכשל',
        description: 'x',
        actionLabel: 'פתח',
        actionHref: '/admin/orders?orderId=1'
      }
    ],
    todaySummary: {
      date: '2026-08-02',
      ordersCount: 2,
      expectedRevenue: 300,
      portionsTotal: 10,
      deliveries: 1,
      pickups: 1,
      unknownFulfillment: 0,
      awaitingApproval: 1,
      byStatus: [{ status: 'pending', count: 1 }]
    },
    tomorrowSummary: {
      date: '2026-08-03',
      ordersCount: 0,
      expectedRevenue: 0,
      portionsTotal: 0,
      deliveries: 0,
      pickups: 0,
      unknownFulfillment: 0,
      awaitingApproval: 0,
      byStatus: []
    },
    upcomingPreparation: {
      eventDate: '2026-08-02',
      ordersCount: 2,
      portionsTotal: 10,
      portionsEvening: 6,
      portionsMorning: 4,
      topItems: [{ name: 'חלות', quantity: 6 }],
      notesOrders: []
    },
    upcomingOrders: [
      {
        id: 'oid1',
        orderNumber: 'A-1',
        customerName: 'לקוח',
        eventDate: '2026-08-02',
        fulfillment: 'delivery',
        totalPrice: 120,
        paymentStatus: 'captured',
        status: 'processing'
      }
    ],
    insights: [{ id: 'i1', text: 'תובנה לדוגמה' }],
    financialSummary: {
      capturedRevenue: 1000,
      paidOrders: 10,
      averageOrderValue: 100,
      awaitingPayments: 1,
      awaitingCount: 1,
      awaitingAmount: 50,
      failedPayments: 0,
      failedCount: 0,
      failedAmount: 0,
      returningCustomers: 2,
      capturedRevenueChange: { value: 1000, previousValue: 500, changePercent: 100 },
      paidOrdersChange: { value: 10, previousValue: 5, changePercent: 100 },
      averageOrderValueChange: { value: 100, previousValue: 100, changePercent: 0 }
    },
    generatedAt: '2026-08-02T16:00:00.000Z',
    ...overrides
  };
}

describe('AdminDashboardComponent ops', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let orderService: jasmine.SpyObj<OrderService>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    orderService = jasmine.createSpyObj('OrderService', ['getDashboardOverview', 'setOrderTestFlag']);
    authService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: { id: '1', username: 'admin', role: 'admin' }
    });
    orderService.getDashboardOverview.and.returnValue(of(sampleOverview()));

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  });

  it('loads ops sections and maps zeros in trend', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.overview).toBeTruthy();
    expect(component.actionItems.length).toBe(1);
    expect(component.activeDaySummary?.ordersCount).toBe(2);
    expect(component.upcomingOrders.length).toBe(1);
    expect(component.trendChartData.datasets[0].data[0]).toBe(0);
    expect(component.insights.length).toBe(1);
  }));

  it('keeps previous data marked stale on refresh error', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    orderService.getDashboardOverview.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    component.reload();
    tick();
    expect(component.overview).toBeTruthy();
    expect(component.staleWarning).toBeTrue();
    expect(component.errorMessage).toBeTruthy();
  }));

  it('clears data on first-load error', fakeAsync(() => {
    orderService.getDashboardOverview.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 403 }))
    );
    fixture.detectChanges();
    tick();
    expect(component.overview).toBeNull();
    expect(component.errorMessage).toContain('הרשאה');
  }));

  it('switches day view and trend metric including AOV', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.dayView = 'tomorrow';
    expect(component.activeDaySummary?.ordersCount).toBe(0);
    component.setTrendMetric('averageOrderValue');
    expect(component.trendChartData.datasets[0].data[1]).toBe(100);
  }));

  it('keeps awaitingAmount as money and awaitingPayments as count', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.finance.awaitingAmount).toBe(50);
    expect(component.finance.awaitingPayments).toBe(1);
    expect(component.finance.awaitingAmount).not.toBe(component.finance.awaitingPayments);
  }));

  it('shows compact empty day when ordersCount is 0', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.dayView = 'tomorrow';
    fixture.detectChanges();
    expect(component.activeDaySummary?.ordersCount).toBe(0);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.empty-compact')).toBeTruthy();
    expect(html.querySelector('.day-grid')).toBeFalsy();
  }));

  it('defaults sales range to last30 independent of primary/finance preset', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.salesPreset).toBe('last30');
    expect(component.primaryPreset).toBe('this_month');
    expect(component.selectedPreset).toBe('month');
    component.selectPreset('week');
    tick();
    expect(component.selectedPreset).toBe('week');
    expect(component.primaryPreset).toBe('last7');
    expect(component.salesPreset).toBe('last30');
    expect(component.selectedSalesCategories.length).toBe(1);
    expect(component.salesTone('סלטים')).toBe(5);
  }));

  it('limits visible action items to 5 by default', fakeAsync(() => {
    const many = Array.from({ length: 7 }).map((_, i) => ({
      id: String(i),
      type: 'new_pending' as const,
      severity: 'medium' as const,
      title: 't',
      description: 'd',
      actionLabel: 'a',
      actionHref: '/admin/orders'
    }));
    orderService.getDashboardOverview.and.returnValue(of(sampleOverview({ actionItems: many })));
    fixture.detectChanges();
    tick();
    expect(component.visibleActionItems.length).toBe(5);
    component.showAllActions = true;
    expect(component.visibleActionItems.length).toBe(7);
  }));
});
