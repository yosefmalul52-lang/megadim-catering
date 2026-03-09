/**
 * Single source of truth for main navigation.
 * Used by both desktop header and mobile sidenav so they stay in sync.
 */
export interface NavLink {
  path: string;
  labelKey: string; // e.g. 'NAV.HOME' for translate pipe
}

export const MAIN_NAV_LINKS: NavLink[] = [
  { path: '/', labelKey: 'NAV.HOME' },
  { path: '/about', labelKey: 'NAV.ABOUT' },
  { path: '/catering', labelKey: 'NAV.CATERING' },
  { path: '/holiday-food', labelKey: 'NAV.HOLIDAY_CATERING' },
  { path: '/ready-for-shabbat', labelKey: 'NAV.READY_FOOD' },
  { path: '/cholent', labelKey: 'NAV.CHOLENT' },
  { path: '/kosher', labelKey: 'NAV.KOSHER' },
  { path: '/contact', labelKey: 'NAV.CONTACT' }
];
