import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

const PIXEL_ID = '554257163533711';

/**
 * Consent-gated Meta (Facebook) Pixel service.
 *
 * The fbevents.js library is loaded via index.html which creates the fbq stub
 * and queues calls before the SDK arrives. This service calls fbq('init') and
 * fires PageView events ONLY after the user accepts cookies, keeping us
 * compliant with GDPR and the Israeli Privacy Protection Law.
 *
 * Usage: inject this service and call initializePixel() once on app start
 * (and again after the user accepts the cookie banner).
 */
@Injectable({ providedIn: 'root' })
export class MetaPixelService {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private pixelInitialized = false;
  private routerTrackingEnabled = false;

  /**
   * Initialize the pixel and begin tracking. Safe to call multiple times
   * (idempotent — re-entrant calls after first initialization are no-ops).
   */
  initializePixel(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.hasMarketingConsent()) {
      return;
    }
    if (typeof window.fbq !== 'function') {
      return;
    }

    if (!this.pixelInitialized) {
      window.fbq('init', PIXEL_ID);
      this.pixelInitialized = true;
    }

    // Fire PageView for the current page, then enable per-route tracking.
    this.trackPageView();
    this.enableRouterTracking();
  }

  private hasMarketingConsent(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const consent = localStorage.getItem('cookieConsent');
    // Mirror the same consent values that AnalyticsService accepts.
    return consent === 'all' || consent === 'accepted';
  }

  private enableRouterTracking(): void {
    if (this.routerTrackingEnabled) {
      return;
    }
    this.routerTrackingEnabled = true;

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.trackPageView());
  }

  private trackPageView(): void {
    if (!this.hasMarketingConsent() || typeof window.fbq !== 'function') {
      return;
    }
    window.fbq('track', 'PageView');
  }
}
