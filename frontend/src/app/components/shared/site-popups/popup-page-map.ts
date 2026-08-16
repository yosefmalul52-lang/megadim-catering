import { PopupPageId } from '../../../services/site-popup.service';

/** Map public URL → popup page target id. Returns null for non-public shells. */
export function resolvePopupPageId(rawUrl: string): PopupPageId | null {
  const pathOnly = (rawUrl.split('?')[0] || '/').split('#')[0];
  let path = pathOnly.replace(/\/+$/, '') || '/';

  // Strip locale prefix
  if (path === '/en' || path.startsWith('/en/')) {
    path = path.slice(3) || '/';
  }

  // Skip admin / portal / auth shells
  if (
    path.startsWith('/admin') ||
    path.startsWith('/portal') ||
    path.startsWith('/employee') ||
    path.startsWith('/time-clock') ||
    path.startsWith('/my-zone') ||
    path.startsWith('/login') ||
    path.startsWith('/register')
  ) {
    return null;
  }

  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/about')) return 'about';
  if (path.startsWith('/kosher')) return 'kosher';
  if (path.startsWith('/contact')) return 'contact';
  if (path.startsWith('/cart')) return 'cart';
  if (path.startsWith('/checkout')) return 'checkout';

  if (
    path.startsWith('/events-catering') ||
    path.startsWith('/catering') ||
    path.startsWith('/shabbat-events')
  ) {
    return 'events';
  }

  if (path.startsWith('/cholent')) return 'cholent';

  if (path.startsWith('/holiday-food') || path.startsWith('/holiday')) {
    return 'holiday';
  }

  // ready-for-shabbat subpages first
  if (path.includes('/salads')) return 'salads';
  if (path.includes('/fish')) return 'fish';
  if (path.includes('/desserts')) return 'desserts';
  if (path.includes('/holiday')) return 'holiday';

  if (
    path.startsWith('/ready-for-shabbat') ||
    path.startsWith('/ready-food') ||
    path.startsWith('/shabbat')
  ) {
    return 'ready_for_shabbat';
  }

  return null;
}
