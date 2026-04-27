import { Request, Response, NextFunction } from 'express';

/** Fine-grained capabilities; `admin` bypasses all checks. */
export const CAP = {
  ORDERS_LIST: 'orders:list',
  ORDERS_ANALYTICS: 'orders:analytics',
  ORDERS_STATS: 'orders:stats',
  ORDERS_STATS_REVENUE: 'orders:stats_revenue',
  ORDERS_KITCHEN_REPORT: 'orders:kitchen_report',
  ORDERS_DELIVERY_REPORT: 'orders:delivery_report',
  ORDERS_RECENT: 'orders:recent',
  ORDERS_SEARCH: 'orders:search',
  ORDERS_DASHBOARD_STATS: 'orders:dashboard_stats',
  ORDERS_STATUS_WRITE: 'orders:status_write',
  ORDERS_DATE_WRITE: 'orders:date_write',
  ORDERS_ITEMS_WRITE: 'orders:items_write',
  ORDERS_DELETE: 'orders:delete',
  ORDERS_RESTORE: 'orders:restore',
  ORDERS_DELETE_PERMANENT: 'orders:delete_permanent',
  SHOPPING_LIST: 'shopping:list',
  DELIVERIES_MY_LIST: 'deliveries:my:list',
  DELIVERIES_MY_UPDATE_STATUS: 'deliveries:my:update_status'
} as const;

const DRIVER_CAPABILITIES = new Set<string>([
  CAP.DELIVERIES_MY_LIST,
  CAP.DELIVERIES_MY_UPDATE_STATUS
]);

function isSiteUserStaff(user: any): boolean {
  return user && user.type !== 'employee' && user.role !== 'employee';
}

export function roleHasCapability(role: string | undefined, capability: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (role === 'driver') return DRIVER_CAPABILITIES.has(capability);
  return false;
}

/**
 * Site User JWT only. `admin` always allowed; `driver` only if capability is in driver set.
 */
export function requireCapability(capability: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!isSiteUserStaff(user)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden',
        serverSeesRole: user.role || 'employee'
      });
      return;
    }
    const role = user.role as string;
    if (roleHasCapability(role, capability)) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      message: 'Forbidden',
      serverSeesRole: role || 'none'
    });
  };
}

/** Only `admin` site users (not driver, not employee token). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (!isSiteUserStaff(user)) {
    res.status(403).json({
      success: false,
      message: 'Forbidden',
      serverSeesRole: user.role || 'employee'
    });
    return;
  }
  if (user.role === 'admin') {
    next();
    return;
  }
  res.status(403).json({
    success: false,
    message: 'Forbidden: Admin access required',
    serverSeesRole: user.role
  });
}
