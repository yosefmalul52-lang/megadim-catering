import { Router } from '@angular/router';

/** Paths institution users may visit outside /portal (login only). */
export const INSTITUTION_ALLOWED_PATH_PREFIXES = ['/portal', '/login'] as const;

export function isInstitutionAllowedPath(url: string): boolean {
  const path = (url || '/').split('?')[0];
  return INSTITUTION_ALLOWED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function navigateAfterLogin(router: Router, role: string | undefined): void {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') {
    router.navigate(['/admin']);
  } else if (r === 'driver') {
    router.navigate(['/admin/delivery']);
  } else if (r === 'institution') {
    router.navigate(['/portal']);
  } else {
    router.navigate(['/']);
  }
}

export function institutionProfileLink(role: string | undefined): string {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return '/admin';
  if (r === 'institution') return '/portal';
  return '/profile';
}
