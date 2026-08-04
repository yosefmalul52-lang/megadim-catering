import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminKitchenReportComponent } from './kitchen-report.component';
import { OrderService } from '../../../services/order.service';
import { KitchenOpsService } from '../../../services/kitchen-ops.service';
import { SiteSettingsService } from '../../../services/site-settings.service';

function sampleOps() {
  return {
    generatedAt: '2026-08-02T18:00:00.000Z',
    view: 'today',
    day: '2026-08-02',
    reportVersion: 'KR-test',
    summary: {
      tasksTotal: 1,
      tasksOpen: 1,
      tasksDone: 0,
      tasksOverdue: 0,
      tasksBlocked: 0,
      tasksNeedsReview: 0,
      orderedPortions: 3,
      activeOrders: 1,
      allergyAlerts: 1
    },
    byStage: [{ stage: 'general', stageLabel: 'משימה כללית', count: 1, planned: 3, actual: 0 }],
    tasks: [
      {
        id: 't1',
        _id: 't1',
        title: 'הכנה בסיסית',
        stageLabel: 'משימה כללית',
        statusLabel: 'לא התחיל',
        status: 'not_started',
        version: 1,
        plannedQuantity: 3,
        unit: "יח'",
        orderSnapshot: { orderNumber: 'MG-1', allergies: 'בוטנים', eventDate: '2026-08-02' },
        checklist: [{ id: 'c1', label: 'בדוק אלרגיה', done: false }]
      }
    ],
    capacity: [{ stationId: 's1', name: 'קו חם', configured: false }],
    ingredients: { completeness: 'none', items: [], missingRecipes: ['חלות'] },
    fulfillmentLines: [],
    eventTimeline: { days: [], overallCompletionPercent: 0 },
    changes: { orderNotes: [], alerts: [], tasksNeedsReview: [], criticalAllergyAcksNeeded: [] },
    kitchenQuantitiesReport: {
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
      alerts: [],
      preparationGroups: [],
      orderNotes: [
        {
          orderId: '1',
          orderNumber: 'MG-1',
          customerName: 'דנה',
          meal: 'ליל שבת',
          fulfillment: 'משלוח',
          preparationLabel: '2026-08-02',
          allergies: 'בוטנים',
          itemNotes: [],
          status: 'processing',
          isCancelled: false,
          isChanged: false
        }
      ],
      cancelledAndChanged: [],
      legacyItems: []
    }
  };
}

describe('AdminKitchenReportComponent ops', () => {
  let fixture: ComponentFixture<AdminKitchenReportComponent>;
  let component: AdminKitchenReportComponent;
  let orderService: jasmine.SpyObj<OrderService>;
  let opsService: jasmine.SpyObj<KitchenOpsService>;

  beforeEach(async () => {
    orderService = jasmine.createSpyObj('OrderService', [
      'getAdvancedKitchenReport',
      'exportKitchenReport',
      'updateKitchenPreparation',
      'updateKitchenAllergyInfo',
      'getKitchenPrintPack',
      'markKitchenPrinted'
    ]);
    opsService = jasmine.createSpyObj('KitchenOpsService', [
      'getOpsReport',
      'exportOps',
      'taskAction',
      'buildPlan',
      'syncReview',
      'bulkActions',
      'updateTask',
      'getPrepDayReport',
      'upsertPrepAssignment',
      'splitPrepAssignment'
    ]);
    const sample = sampleOps();
    orderService.getAdvancedKitchenReport.and.returnValue(of(sample.kitchenQuantitiesReport as any));
    orderService.getKitchenPrintPack.and.returnValue(of('<html dir="rtl"><body>print</body></html>'));
    orderService.markKitchenPrinted.and.returnValue(of({ ok: true } as any));
    opsService.getOpsReport.and.returnValue(of(sample));
    opsService.getPrepDayReport.and.returnValue(
      of({
        day: '2026-08-02',
        orderKind: 'all',
        lines: [
          {
            key: 'hummus',
            name: 'חומוס',
            optionLabel: '',
            sizeLabel: '',
            category: 'סלטים',
            unit: "יח'",
            quantity: 5,
            orderCount: 2,
            sources: [
              {
                orderId: '1',
                orderNumber: 'MG-1',
                orderItemKey: 'hummus',
                quantity: 2,
                prepDate: '2026-08-02',
                deliveryDate: '2026-08-02',
                orderKind: 'shabbat_ready',
                orderKindLabel: 'אוכל מוכן לשבת וחג'
              },
              {
                orderId: '2',
                orderNumber: 'MG-2',
                orderItemKey: 'hummus',
                quantity: 3,
                prepDate: '2026-08-02',
                deliveryDate: '2026-08-03',
                orderKind: 'events',
                orderKindLabel: 'קייטרינג לאירועים'
              }
            ]
          }
        ],
        summary: { dishCount: 1, totalQuantity: 5 }
      })
    );
    opsService.exportOps.and.returnValue(of(new Blob(['x'])));
    opsService.taskAction.and.returnValue(of({ id: 't1', version: 2 }));
    opsService.upsertPrepAssignment.and.returnValue(of({ assignment: { id: 'a1', prepDate: '2026-08-03' } }));
    opsService.splitPrepAssignment.and.returnValue(of({ assignments: [] }));
    opsService.buildPlan.and.returnValue(
      of({ preview: true, warnings: ['אין תוכנית מפורטת'], tasks: [{ title: 'הכנה', plannedStartAt: '2026-08-02T08:00:00.000Z' }], orderSnapshot: { orderNumber: 'MG-1' } })
    );
    const settingsService = jasmine.createSpyObj('SiteSettingsService', ['getSettings']);
    settingsService.getSettings.and.returnValue(of({ kitchenPrepListsEnabled: true } as any));

    await TestBed.configureTestingModule({
      imports: [AdminKitchenReportComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        { provide: KitchenOpsService, useValue: opsService },
        { provide: SiteSettingsService, useValue: settingsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminKitchenReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads day orders on main screen and keeps advanced ops available', () => {
    expect(orderService.getAdvancedKitchenReport).toHaveBeenCalled();
    expect(opsService.getOpsReport).toHaveBeenCalled();
    expect(opsService.getPrepDayReport).toHaveBeenCalled();
    expect(component.dayOrders.length).toBe(1);
    expect(component.prepRows.length).toBe(1);
    expect(component.prepRows[0].plannedQuantity).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('הזמנות היום');
    expect(fixture.nativeElement.textContent).toContain('MG-1');
    expect(fixture.nativeElement.textContent).toContain('ניהול מטבח מתקדם');
    expect(fixture.nativeElement.textContent).toContain('קייטרינג לאירועים');
  });

  it('filters by order kind and reloads classic + prep day', () => {
    component.setOrderKind('events');
    expect(component.orderKind).toBe('events');
    const classicArgs = orderService.getAdvancedKitchenReport.calls.mostRecent().args[0];
    expect(classicArgs.orderKind).toBe('events');
    expect(classicArgs.dateBasis).toBe('delivery');
    const prepArgs = opsService.getPrepDayReport.calls.mostRecent().args[0];
    expect(prepArgs.orderKind).toBe('events');
  });

  it('filters by catering_shabbat order kind', () => {
    component.setOrderKind('catering_shabbat');
    expect(component.orderKind).toBe('catering_shabbat');
    const classicArgs = orderService.getAdvancedKitchenReport.calls.mostRecent().args[0];
    expect(classicArgs.orderKind).toBe('catering_shabbat');
    expect(component.orderKindLabel).toBe('קייטרינג לאירועי שבת וחג');
  });

  it('print labels include the active order-kind filter', fakeAsync(() => {
    component.orderKind = 'shabbat_ready';
    spyOn(component as any, 'openPrintWindow');
    component.printAllOrders();
    tick();
    expect(orderService.getKitchenPrintPack).toHaveBeenCalled();
    const packArgs = orderService.getKitchenPrintPack.calls.mostRecent().args;
    expect(packArgs[0]).toBe('orders');
    expect(packArgs[1].orderKind).toBe('shabbat_ready');
    expect((component as any).openPrintWindow).toHaveBeenCalled();
    component.printPrepList();
    tick();
    const prepPack = orderService.getKitchenPrintPack.calls.mostRecent().args;
    expect(prepPack[0]).toBe('prep');
    expect(prepPack[1].orderKind).toBe('shabbat_ready');
  }));

  it('saves prep assignment from modal', fakeAsync(() => {
    component.openAssignFromPrepSource(component.prepRows[0], component.prepRows[0].sources[0]);
    expect(component.assignModal.open).toBeTrue();
    component.assignModal.prepDate = '2026-08-03';
    component.saveAssignModal();
    tick();
    expect(opsService.upsertPrepAssignment).toHaveBeenCalled();
    expect(component.assignModal.open).toBeFalse();
  }));

  it('switches views and reloads', () => {
    component.setView('changes');
    expect(component.view).toBe('changes');
    expect(opsService.getOpsReport).toHaveBeenCalled();
  });

  it('runs task complete action with version', fakeAsync(() => {
    const task = component.ops.tasks[0];
    component.runAction(task, 'complete');
    tick();
    expect(opsService.taskAction).toHaveBeenCalled();
    const args = opsService.taskAction.calls.mostRecent().args;
    expect(args[1].action).toBe('complete');
    expect(args[1].version).toBe(1);
  }));

  it('shows 409 conflict message and reloads', fakeAsync(() => {
    opsService.taskAction.and.returnValue(throwError(() => ({ status: 409 })));
    component.runAction(component.ops.tasks[0], 'start');
    tick();
    expect(component.errorMessage).toContain('עודכנה');
  }));

  it('opens wizard and previews plan', fakeAsync(() => {
    component.openWizard();
    component.wizardOrderId = '507f1f77bcf86cd799439011';
    component.previewPlan();
    tick();
    expect(opsService.buildPlan).toHaveBeenCalled();
    expect(component.wizardStep).toBe(2);
    expect(component.wizardPreview.warnings.length).toBeGreaterThan(0);
  }));

  it('has day-mode and separate order-kind filters', () => {
    expect(component.dayModes.length).toBe(3);
    expect(component.orderKindOptions.map((o) => o.key)).toEqual([
      'all',
      'shabbat_ready',
      'catering_shabbat',
      'events',
      'institutions'
    ]);
  });

  it('exports with active view filters', () => {
    component.view = 'today';
    component.export('csv');
    expect(opsService.exportOps).toHaveBeenCalled();
    const params = opsService.exportOps.calls.mostRecent().args[1];
    expect(params['view']).toBe('today');
  });
});
