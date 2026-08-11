/**
 * Public-site locale helpers.
 * Hebrew URLs stay unprefixed; English uses /en/...
 * Admin / portal / employee paths are never localized.
 */

export type AppLocale = 'he' | 'en';

export const LOCALE_STORAGE_KEY = 'megadim-public-locale';

/** Paths that must never get an /en prefix (always Hebrew UX). */
export const NON_LOCALIZED_PREFIXES = [
  '/admin',
  '/portal',
  '/my-zone',
  '/employee-login',
  '/time-clock'
] as const;

export function isNonLocalizedPath(urlPath: string): boolean {
  const path = urlPath.split('?')[0].split('#')[0] || '/';
  return NON_LOCALIZED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/** Strip query/hash; return pathname starting with /. */
export function pathnameOnly(url: string): string {
  const raw = (url || '/').split('?')[0].split('#')[0] || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function getLocaleFromUrl(url: string): AppLocale {
  const path = pathnameOnly(url);
  if (path === '/en' || path.startsWith('/en/')) return 'en';
  return 'he';
}

/** Remove leading /en from a public path. */
export function stripLocalePrefix(url: string): string {
  const path = pathnameOnly(url);
  if (path === '/en') return '/';
  if (path.startsWith('/en/')) {
    const rest = path.slice(3);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return path || '/';
}

/** Add /en prefix to a Hebrew (or already-stripped) path. */
export function addLocalePrefix(url: string, locale: AppLocale): string {
  const base = stripLocalePrefix(url);
  if (locale === 'he') return base === '' ? '/' : base;
  if (base === '/') return '/en';
  return `/en${base}`;
}

/**
 * Switch locale while keeping the same logical page.
 * Non-localized areas stay as-is (or go to home in target locale).
 */
export function switchLocaleUrl(currentUrl: string, target: AppLocale): string {
  const path = pathnameOnly(currentUrl);
  const query = currentUrl.includes('?') ? currentUrl.slice(currentUrl.indexOf('?')) : '';
  const hash = !query && currentUrl.includes('#')
    ? currentUrl.slice(currentUrl.indexOf('#'))
    : currentUrl.includes('#') && query
      ? ''
      : currentUrl.includes('#')
        ? currentUrl.slice(currentUrl.indexOf('#'))
        : '';

  // Preserve query from original
  const qIndex = currentUrl.indexOf('?');
  const hIndex = currentUrl.indexOf('#');
  let suffix = '';
  if (qIndex >= 0) {
    suffix = currentUrl.slice(qIndex);
  } else if (hIndex >= 0) {
    suffix = currentUrl.slice(hIndex);
  }

  if (isNonLocalizedPath(path)) {
    return target === 'en' ? `/en${suffix}` : `/${suffix}`.replace(/\/\?/, '?').replace(/\/#/, '#') || '/';
  }

  return `${addLocalePrefix(path, target)}${suffix}`;
}

export function localizeNavPath(path: string, locale: AppLocale): string {
  if (!path || path === '/') {
    return locale === 'en' ? '/en' : '/';
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (isNonLocalizedPath(normalized)) return normalized;
  return addLocalePrefix(normalized, locale);
}
