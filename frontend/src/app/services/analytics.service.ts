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
 * Consent-gated GA4 integration: loads gtag when cookieConsent is 'all' or legacy 'accepted'
 * and tracks SPA navigations via Router NavigationEnd events.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private routerTrackingEnabled = false;
  private gtagScriptAppended = false;

  /** Load GA4 (if allowed) and wire router page-view tracking. Safe to call multiple times. */
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

    this.ensureGtagBootstrap(measurementId);
    this.appendGtagScript(measurementId);
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

  private ensureGtagBootstrap(measurementId: string): void {
    window.dataLayer = window.dataLayer ?? [];
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
      window.gtag('js', new Date());
      window.gtag('config', measurementId);
    }
  }

  private appendGtagScript(measurementId: string): void {
    const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existing || this.gtagScriptAppended) {
      this.gtagScriptAppended = true;
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = scriptSrc;
    document.head.appendChild(script);
    this.gtagScriptAppended = true;
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
