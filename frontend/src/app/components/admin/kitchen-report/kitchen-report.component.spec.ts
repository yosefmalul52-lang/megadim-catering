import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminKitchenReportComponent } from './kitchen-report.component';
import { OrderService } from '../../../services/order.service';
import { KitchenReportDTO } from '../../../utils/kitchen-report.util';

function sampleReport(): KitchenReportDTO {
  return {
    generatedAt: '2026-08-02T18:00:00.000Z',
    timezone: 'Asia/Jerusalem',
    range: { startDate: '2026-08-02', endDate: '2026-08-04' },
    filters: {},
    summary: {
      activeOrders: 1,
      totalPortions: 3,
      distinctDishes: 1,
      deliveries: 1,
      pickups: 0,
      unknownFulfillment: 0,
      allergyAlerts: 1,
      changedOrders: 0,
      cancelledOrders: 0
    },
    alerts: [
      {
        id: 'a1',
        kind: 'allergy',
        severity: 'critical',
        title: 'אלרגיה',
        detail: 'בוטנים',
        orderNumber: 'MG-1'
      }
    ],
    preparationGroups: [
      {
        preparationKey: '2026-08-02',
        preparationLabel: '2026-08-02 (לפי אספקה)',
        preparationAt: null,
        isManualPreparation: false,
        ordersCount: 1,
        deliveries: 1,
        pickups: 0,
        meals: [
          {
            meal: 'ארוחה כללית',
            ordersCount: 1,
            portionsTotal: 3,
            deliveries: 1,
            pickups: 0,
            dishes: [
              {
                key: 'k1',
                name: 'חלות',
                optionLabel: '',
                sizeLabel: '',
                category: 'מאפים',
                unit: "יח'",
                quantity: 3,
                orderCount: 1,
                sources: [{ orderId: '1', orderNumber: 'MG-1', quantity: 3 }]
              }
            ]
          }
        ]
      }
    ],
    orderNotes: [],
    cancelledAndChanged: []
  };
}

describe('AdminKitchenReportComponent', () => {
  let fixture: ComponentFixture<AdminKitchenReportComponent>;
  let component: AdminKitchenReportComponent;
  let orderService: jasmine.SpyObj<OrderService>;

  beforeEach(async () => {
    orderService = jasmine.createSpyObj('OrderService', [
      'getAdvancedKitchenReport',
      'exportKitchenReport'
    ]);
    orderService.getAdvancedKitchenReport.and.returnValue(of(sampleReport()));
    orderService.exportKitchenReport.and.returnValue(of(new Blob(['x'])));

    await TestBed.configureTestingModule({
      imports: [AdminKitchenReportComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: OrderService, useValue: orderService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminKitchenReportComponent);
    component = fixture.componentInstance;
  });

  it('loads report and shows allergy alert', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.report?.summary.activeOrders).toBe(1);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('אלרגיה');
    expect(el.textContent).toContain('חלות');
  }));

  it('shows empty state when no groups', fakeAsync(() => {
    orderService.getAdvancedKitchenReport.and.returnValue(
      of({ ...sampleReport(), preparationGroups: [], summary: { ...sampleReport().summary, activeOrders: 0 } })
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('אין הזמנות פעילות');
  }));

  it('shows error state', fakeAsync(() => {
    orderService.getAdvancedKitchenReport.and.returnValue(throwError(() => ({ status: 500 })));
    fixture.detectChanges();
    tick();
    expect(component.errorMessage).toBeTruthy();
  }));

  it('exports with current filters', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.export('csv');
    tick();
    expect(orderService.exportKitchenReport).toHaveBeenCalled();
    const args = orderService.exportKitchenReport.calls.mostRecent().args;
    expect(args[0]).toBe('csv');
    expect(args[1].startDate).toBeTruthy();
  }));
});
