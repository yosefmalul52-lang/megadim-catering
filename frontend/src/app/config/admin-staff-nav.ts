/** Roles that may access the /admin shell at all */
export const ADMIN_STAFF_ROLES = ['admin', 'driver'] as const;
export type AdminStaffRole = (typeof ADMIN_STAFF_ROLES)[number];

export interface AdminNavItem {
  routerLink: string;
  iconClass: string;
  label: string;
  /** Who sees this link in the sidebar (must match route `data.adminRoles`) */
  roles: readonly AdminStaffRole[];
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { routerLink: '/admin/dashboard', iconClass: 'fas fa-chart-line', label: 'לוח בקרה', roles: ['admin'] },
  { routerLink: '/admin/menu', iconClass: 'fas fa-utensils', label: 'ניהול תפריט', roles: ['admin'] },
  { routerLink: '/admin/orders', iconClass: 'fas fa-shopping-cart', label: 'הזמנות', roles: ['admin'] },
  { routerLink: '/admin/leads', iconClass: 'fas fa-address-book', label: 'לידים', roles: ['admin'] },
  { routerLink: '/admin/marketing', iconClass: 'fas fa-bullhorn', label: 'ניהול קמפיינים', roles: ['admin'] },
  { routerLink: '/admin/customers', iconClass: 'fas fa-users', label: 'ניהול לקוחות (CRM)', roles: ['admin'] },
  { routerLink: '/admin/coupons', iconClass: 'fas fa-ticket-alt', label: 'ניהול קופונים', roles: ['admin'] },
  { routerLink: '/admin/shipping', iconClass: 'fas fa-money-bill-wave', label: 'מחירי משלוח ואזורים', roles: ['admin'] },
  { routerLink: '/admin/delivery', iconClass: 'fas fa-truck', label: 'סידור משלוחים', roles: ['admin', 'driver'] },
  { routerLink: '/admin/delivery-pricing', iconClass: 'fas fa-map-marked-alt', label: 'תמחור משלוחים', roles: ['admin'] },
  { routerLink: '/admin/shopping', iconClass: 'fas fa-shopping-basket', label: 'רשימת קניות', roles: ['admin'] },
  { routerLink: '/admin/gallery', iconClass: 'fas fa-images', label: 'ניהול גלריה', roles: ['admin'] },
  { routerLink: '/admin/settings', iconClass: 'fas fa-cog', label: 'הגדרות אתר', roles: ['admin'] }
];

export function canSeeNavItem(role: string | undefined, item: AdminNavItem): boolean {
  const r = role as AdminStaffRole | undefined;
  return !!r && (item.roles as readonly string[]).includes(r);
}
