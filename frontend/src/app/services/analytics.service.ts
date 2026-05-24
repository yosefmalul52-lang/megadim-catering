import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const COOKIE_CONSENT_ALL = 'all';
/** Legacy banner stored this value; treat like full marketing consent for GA4. */
const COOKIE_CONSENT_LEGACY_ACCEPTED = 'accepted';

/**
 * Consent-gated GA4: gtag library loads from index.html; measurement starts only after consent.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private routerTrackingEnabled = false;
  private analyticsConfigured = false;

  /** Enable GA4 measurement (if consented). Safe to call multiple times. */
  initializeAnalytics(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.hasAnalyticsConsent()) {
      return;
    }

    const measurementId = this.getMeasurementId();
    if (!measurementId) {
      return;
    }

    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      if (!this.analyticsConfigured) {
        window.gtag('config', measurementId);
        this.analyticsConfigured = true;
        console.log(`--- GA Config initialized with ${measurementId} ---`);
      }
    }

    this.enableRouterTracking();
    this.trackPageView(this.router.url);
  }

  private getMeasurementId(): string {
    return (environment.googleAnalyticsId ?? '').trim();
  }

  private hasAnalyticsConsent(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const consent = localStorage.getItem('cookieConsent');
    return consent === COOKIE_CONSENT_ALL || consent === COOKIE_CONSENT_LEGACY_ACCEPTED;
  }

  private enableRouterTracking(): void {
    if (this.routerTrackingEnabled) {
      return;
    }
    this.routerTrackingEnabled = true;

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.trackPageView(e.urlAfterRedirects));
  }

  private trackPageView(pagePath: string): void {
    if (!this.hasAnalyticsConsent()) {
      return;
    }

    const measurementId = this.getMeasurementId();
    if (!measurementId || typeof window.gtag !== 'function') {
      return;
    }

    window.gtag('config', measurementId, {
      page_path: pagePath,
      page_title: typeof document !== 'undefined' ? document.title : ''
    });
  }
}
