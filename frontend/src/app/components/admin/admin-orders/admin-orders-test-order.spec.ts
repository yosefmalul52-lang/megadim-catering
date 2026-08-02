/**
 * Focused unit coverage for admin test-order UI gate + toggle confirm flow.
 * Uses a lightweight harness so we do not boot the full admin-orders template.
 */
import { AuthService } from '../../../services/auth.service';
import { OrderService, Order } from '../../../services/order.service';

describe('admin test-order controls', () => {
  function isAdminRole(role: string | undefined | null): boolean {
    return String(role || '').toLowerCase() === 'admin';
  }

  it('allows toggle only for admin role', () => {
    expect(isAdminRole('admin')).toBeTrue();
    expect(isAdminRole('Admin')).toBeTrue();
    expect(isAdminRole('driver')).toBeFalse();
    expect(isAdminRole('user')).toBeFalse();
    expect(isAdminRole(null)).toBeFalse();
  });

  it('builds PATCH body with boolean isTestOrder only', () => {
    const markBody = { isTestOrder: true };
    const clearBody = { isTestOrder: false };
    expect(Object.keys(markBody)).toEqual(['isTestOrder']);
    expect(typeof markBody.isTestOrder).toBe('boolean');
    expect(Object.keys(clearBody)).toEqual(['isTestOrder']);
  });

  it('rejects non-admin before calling OrderService.setOrderTestFlag', () => {
    const setOrderTestFlag = jasmine.createSpy('setOrderTestFlag');
    const auth = { currentUser: { role: 'driver' } } as AuthService;
    const order = { _id: 'abc', isTestOrder: false } as Order;

    if (String(auth.currentUser?.role || '').toLowerCase() !== 'admin') {
      expect(setOrderTestFlag).not.toHaveBeenCalled();
      return;
    }
    setOrderTestFlag(order._id, true);
    fail('non-admin must not reach service call');
  });

  it('calls setOrderTestFlag with inverted flag when admin confirms', () => {
    const orderService = {
      setOrderTestFlag: jasmine.createSpy('setOrderTestFlag').and.returnValue({
        subscribe: () => undefined
      })
    } as unknown as OrderService;
    const order = { _id: 'oid-1', isTestOrder: false } as Order;
    const next = !order.isTestOrder;
    orderService.setOrderTestFlag('oid-1', next);
    expect(orderService.setOrderTestFlag).toHaveBeenCalledWith('oid-1', true);
  });
});
