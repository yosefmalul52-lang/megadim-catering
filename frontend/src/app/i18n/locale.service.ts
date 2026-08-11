import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { LanguageService } from '../services/language.service';
import {
  AppLocale,
  LOCALE_STORAGE_KEY,
  getLocaleFromUrl,
  isNonLocalizedPath,
  localizeNavPath,
  switchLocaleUrl
} from './locale.util';

/**
 * Source of truth for public-site locale.
 * Synced from the URL (/en/...) with TranslateService + LanguageService + document dir/lang.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly localeSubject = new BehaviorSubject<AppLocale>('he');
  readonly locale$ = this.localeSubject.asObservable();

  private started = false;

  get locale(): AppLocale {
    return this.localeSubject.value;
  }

  get isEnglish(): boolean {
    return this.locale === 'en';
  }

  /** Call once from AppComponent. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.translate.setFallbackLang('he');

    // Initial URL (and optional stored preference only when landing on bare home)
    this.syncFromUrl(this.router.url);

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.syncFromUrl(e.urlAfterRedirects || e.url));
  }

  /** Apply locale from current URL; force Hebrew on non-localized shells. */
  syncFromUrl(url: string): void {
    const path = (url || '/').split('?')[0];
    if (isNonLocalizedPath(path)) {
      this.applyLocale('he', { persist: false, updateTranslate: true });
      return;
    }
    this.applyLocale(getLocaleFromUrl(url), { persist: true, updateTranslate: true });
  }

  applyLocale(
    locale: AppLocale,
    opts: { persist?: boolean; updateTranslate?: boolean } = {}
  ): void {
    const { persist = true, updateTranslate = true } = opts;
    if (this.localeSubject.value !== locale) {
      this.localeSubject.next(locale);
    }
    this.languageService.setLanguage(locale);
    if (updateTranslate) {
      this.translate.use(locale);
    }
    this.updateDocument(locale);
    if (persist && isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        /* ignore */
      }
    }
  }

  /** Navigate to the parallel page in the other/public locale. */
  switchTo(target: AppLocale): void {
    if (isNonLocalizedPath(this.router.url)) {
      this.router.navigateByUrl(target === 'en' ? '/en' : '/');
      return;
    }
    const next = switchLocaleUrl(this.router.url, target);
    if (next.split('?')[0] === this.router.url.split('?')[0] && getLocaleFromUrl(this.router.url) === target) {
      this.applyLocale(target);
      return;
    }
    this.router.navigateByUrl(next);
  }

  localizePath(path: string): string {
    return localizeNavPath(path, this.locale);
  }

  private updateDocument(locale: AppLocale): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const html = document.documentElement;
    html.setAttribute('lang', locale === 'en' ? 'en-US' : 'he');
    html.setAttribute('dir', locale === 'en' ? 'ltr' : 'rtl');
  }
}
