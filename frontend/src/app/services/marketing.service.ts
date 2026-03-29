import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export const MEGADIM_UTMS_STORAGE_KEY = 'megadim_utms';

export type UtmRecord = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/**
 * Captures standard UTM query parameters on navigation and persists them in localStorage
 * so they can be attached to order and contact submissions.
 */
@Injectable({ providedIn: 'root' })
export class MarketingService {
  private readonly router = inject(Router);

  constructor() {
    this.captureFromUrl(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.captureFromUrl(e.urlAfterRedirects));
  }

  /** Reads UTM params from the URL and merges any found values into stored UTMs. */
  captureFromUrl(url: string): void {
    const tree = this.router.parseUrl(url);
    const params = tree.queryParams;
    const fromUrl: UtmRecord = {};
    for (const key of UTM_KEYS) {
      const v = params[key];
      if (v != null && String(v).trim() !== '') {
        fromUrl[key] = String(v).trim();
      }
    }
    if (Object.keys(fromUrl).length === 0) {
      return;
    }
    const existing = this.getUtms();
    const merged: UtmRecord = { ...existing, ...fromUrl };
    this.persist(merged);
  }

  /** Returns persisted UTM key/value pairs (may be empty). */
  getUtms(): UtmRecord {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    try {
      const raw = localStorage.getItem(MEGADIM_UTMS_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
      }
      const out: UtmRecord = {};
      for (const key of UTM_KEYS) {
        const val = (parsed as Record<string, unknown>)[key];
        if (typeof val === 'string' && val.trim() !== '') {
          out[key] = val.trim();
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  private persist(utms: UtmRecord): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(MEGADIM_UTMS_STORAGE_KEY, JSON.stringify(utms));
    } catch {
      // ignore quota / private mode
    }
  }
}
