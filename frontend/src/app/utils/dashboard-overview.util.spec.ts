import {
  buildDashboardQuery,
  filterNamedTopItems,
  filterPrepItems,
  formatChangePercent,
  formatKpiChange,
  fulfillmentLabelHe,
  isDateRangeValid,
  formatSalesMonthLabel,
  mapHttpErrorToDashboardMessage,
  normalizeOverview,
  normalizeTopSellingByCategory,
  normalizeTopSellingByMonth,
  parseAdminHref,
  salesCategoryTone
} from './dashboard-overview.util';

describe('dashboard-overview.util (ops)', () => {
  it('formats small-sample KPI changes as absolute deltas', () => {
    const change = formatKpiChange({ value: 5, previousValue: 2, changePercent: 150 });
    expect(change.tone).toBe('up');
    expect(change.label).toContain('יותר');
    expect(change.label).not.toContain('%');
  });

  it('keeps percent when previous sample is large enough', () => {
    const change = formatKpiChange({ value: 120, previousValue: 100, changePercent: 20 });
    expect(change.tone).toBe('up');
    expect(change.label).toContain('%');
  });

  it('maps null changePercent to clear Hebrew copy', () => {
    expect(formatChangePercent(null).label).toContain('אין מספיק');
  });

  it('builds date queries with Asia/Jerusalem', () => {
    expect(buildDashboardQuery('week', '', '')).toEqual({
      preset: 'week',
      timezone: 'Asia/Jerusalem'
    });
    expect(buildDashboardQuery('last30', '', '')).toEqual({
      preset: 'last30',
      timezone: 'Asia/Jerusalem'
    });
    expect(isDateRangeValid('2026-08-01', '2026-08-10')).toBeTrue();
  });

  it('assigns a stable distinct tone per known sales category', () => {
    expect(salesCategoryTone('מנות עיקריות')).toBe(1);
    expect(salesCategoryTone('תוספות')).toBe(2);
    expect(salesCategoryTone('דגים')).toBe(4);
    expect(salesCategoryTone('קינוחים')).toBe(6);
    expect(salesCategoryTone('מנות עיקריות')).toBe(salesCategoryTone('מנות עיקריות'));
    expect(salesCategoryTone('קטגוריה-לא-ידועה')).toBeGreaterThan(0);
  });

  it('filters sold items requiring name quantity and revenue', () => {
    expect(
      filterNamedTopItems([
        { name: 'סלט', quantity: 2, revenue: 20 },
        { name: 'x', quantity: 0, revenue: 10 },
        { name: '', quantity: 1, revenue: 1 }
      ]).length
    ).toBe(1);
  });

  it('filters prep items requiring name and quantity > 0', () => {
    expect(filterPrepItems([{ name: 'חלות', quantity: 3 }, { name: 'a', quantity: 0 }])).toEqual([
      { name: 'חלות', quantity: 3 }
    ]);
  });

  it('parses admin deep-link hrefs', () => {
    expect(parseAdminHref('/admin/orders?orderId=abc&statusTab=failed')).toEqual({
      path: '/admin/orders',
      queryParams: { orderId: 'abc', statusTab: 'failed' }
    });
  });

  it('labels unknown fulfillment as missing delivery type', () => {
    expect(fulfillmentLabelHe('unknown')).toBe('סוג אספקה חסר');
    expect(fulfillmentLabelHe('delivery')).toBe('משלוח');
  });

  it('normalizes topSellingByCategory and legacy month payloads', () => {
    const categories = normalizeTopSellingByCategory([
      {
        category: 'סלטים',
        items: [
          { name: 'חומוס', quantity: 3, revenue: 30 },
          { name: '', quantity: 2, revenue: 2 },
          { name: 'טחינה', quantity: 0, revenue: 0 }
        ]
      }
    ]);
    expect(categories.length).toBe(1);
    expect(categories[0].items.map((i) => i.name)).toEqual(['חומוס']);

    const months = normalizeTopSellingByMonth([
      {
        month: '2026-08',
        categories: [{ category: 'סלטים', items: [{ name: 'חומוס', quantity: 3, revenue: 30 }] }]
      },
      { month: 'bad', categories: [{ category: 'x', items: [{ name: 'y', quantity: 1, revenue: 1 }] }] }
    ]);
    expect(months.length).toBe(1);
    expect(formatSalesMonthLabel('2026-08')).toContain('2026');
  });

  it('normalizes additive ops fields and drops test orders from upcoming', () => {
    const normalized = normalizeOverview({
      range: {
        from: 'a',
        to: 'b',
        timezone: 'Asia/Jerusalem',
        dateBasis: 'createdAt',
        preset: 'month',
        previous: { from: 'c', to: 'd' }
      },
      kpis: {
        capturedRevenue: { value: 1, previousValue: 1, changePercent: 0 },
        paidOrders: { value: 1, previousValue: 1, changePercent: 0 },
        averageOrderValue: { value: 1, previousValue: 1, changePercent: 0 },
        totalOrders: { value: 1, previousValue: 1, changePercent: 0 },
        activeOrders: { value: 1, previousValue: 1, changePercent: 0 },
        returningCustomers: { value: 0, previousValue: 0, changePercent: 0 }
      },
      paymentAlerts: { awaiting: 0, failed: 0 },
      trend: [{ period: '2026-08-01', revenue: 0, paidOrdersCount: 0 }],
      ordersByStatus: [],
      ordersByType: [],
      topItems: [{ name: 'סלט', quantity: 2, revenue: 20 }],
      upcomingOrders: [
        {
          id: '1',
          fulfillment: 'delivery',
          totalPrice: 10,
          status: 'pending',
          isTestOrder: true
        },
        {
          id: '2',
          fulfillment: 'pickup',
          totalPrice: 20,
          status: 'processing',
          isTestOrder: false
        }
      ],
      actionItems: [],
      insights: [{ id: 'x', text: 'תובנה' }]
    });
    expect(normalized!.upcomingOrders!.length).toBe(1);
    expect(normalized!.upcomingOrders![0].id).toBe('2');
    expect(normalized!.insights!.length).toBe(1);
    expect(mapHttpErrorToDashboardMessage(403)).toContain('הרשאה');
  });
});
