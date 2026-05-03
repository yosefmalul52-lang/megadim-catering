import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SeoTags {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

/** Must stay in sync with `src/index.html` (<title>, meta description, og:title, og:description) to avoid title/description flicker on load. */
export const SITE_DEFAULT_SEO_TITLE =
  'קייטרינג מגדים - אירועי פרימיום וכשרות למהדרין | קייטרינג בשרי לאירועים';
export const SITE_DEFAULT_SEO_DESCRIPTION =
  'שירותי קייטרינג איכותיים וכשרים למהדרין לכל סוגי האירועים – שבתות חתן, בריתות, ואירועים עסקיים. מטבח עשיר עם טעמים ביתיים וטריות ללא פשרות. הזמינו עכשיו!';

/** Same keywords as `src/index.html` meta keywords when home loads. */
export const SITE_DEFAULT_SEO_KEYWORDS =
  'קייטרינג מגדים, קייטרינג כשר למהדרין, קייטרינג בשרי, אירועים, שבת חתן, ברית, קייטרינג עסקי';

/** Production origin for canonical + og:url (avoid localhost/staging in indexed URLs). */
export const SITE_PUBLIC_ORIGIN = 'https://www.megadim-catering.com';

/** Predefined SEO presets for main pages (Megadim Catering) */
export const SEO_PAGES: Record<string, SeoTags> = {
  home: {
    title: SITE_DEFAULT_SEO_TITLE,
    description: SITE_DEFAULT_SEO_DESCRIPTION,
    keywords: SITE_DEFAULT_SEO_KEYWORDS,
    image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906611/IMG_9750_v7mval.jpg',
    url: `${SITE_PUBLIC_ORIGIN}/`
  },
  menu: {
    title: 'תפריט מוכן לשבת - קייטרינג מגדים | סלטים, דגים, מנות עיקריות, קינוחים',
    description: 'מגוון מנות מוכנות לשבת: סלטים טריים, דגים, מנות עיקריות, תוספות וממולאים, קינוחים. הזמינו אוכל כשר לשבת.',
    image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906611/IMG_9750_v7mval.jpg',
    url: `${SITE_PUBLIC_ORIGIN}/ready-for-shabbat`
  },
  about: {
    title: 'אודות קייטרינג מגדים | קייטרינג כשר למהדרין ואירועי פרימיום',
    description:
      'הכירו את מגדים: קייטרינג בשרי כשר למהדרין, מסורת ואיכות ללא פשרות. סיפור המטבח, הערכים והשירות שמלווים אתכם מאירוע לשבת.',
    url: `${SITE_PUBLIC_ORIGIN}/about`
  },
  contact: {
    title: 'צור קשר – קייטרינג מגדים | הזמנות, טעימות והצעות מחיר',
    description:
      'צרו קשר עם קייטרינג מגדים להזמנות, טעימות והצעות מחיר וליווי אישי. מענה מהיר לקייטרינג כשר למהדרין לאירועים ולשבת.',
    url: `${SITE_PUBLIC_ORIGIN}/contact`
  }
};

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  private readonly defaultTitle = SITE_DEFAULT_SEO_TITLE;
  private readonly defaultDescription = SITE_DEFAULT_SEO_DESCRIPTION;

  /**
   * Update document title, meta tags (description, keywords), Open Graph (og:title, og:description, og:image, og:url), and canonical link.
   * Call from each page in ngOnInit or after dynamic data is loaded.
   */
  updateTags(config: SeoTags): void {
    if (config.title) {
      this.title.setTitle(config.title);
      this.meta.updateTag({ property: 'og:title', content: config.title });
    }
    if (config.description) {
      this.meta.updateTag({ name: 'description', content: config.description });
      this.meta.updateTag({ property: 'og:description', content: config.description });
    }
    if (config.keywords) {
      this.meta.updateTag({ name: 'keywords', content: config.keywords });
    }
    const imageUrl = this.toAbsoluteUrl(config.image);
    if (imageUrl) {
      this.meta.updateTag({ property: 'og:image', content: imageUrl });
    }
    // Prefer explicit URL (SSR-safe). Browser-only fallback uses window location.
    const rawPageUrl =
      config.url ||
      (isPlatformBrowser(this.platformId) ? this.doc.defaultView?.location?.href : undefined);
    if (rawPageUrl) {
      const pageUrl = this.normalizePublicSiteUrl(rawPageUrl);
      this.meta.updateTag({ property: 'og:url', content: pageUrl });
      this.setCanonical(pageUrl);
    }
  }

  /** Set or update the canonical link (works in browser + SSR; uses injected DOCUMENT). */
  setCanonical(url: string): void {
    const head = this.doc.getElementsByTagName('head')[0];
    if (!head) return;
    let link = head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', this.normalizePublicSiteUrl(url));
  }

  /**
   * Map any absolute URL (e.g. http://localhost:4200/path) to the public production origin
   * so canonical and og:url always use https://www.megadim-catering.com.
   */
  normalizePublicSiteUrl(url: string): string {
    const trimmed = (url || '').trim();
    if (!trimmed) return `${SITE_PUBLIC_ORIGIN}/`;
    try {
      const u = new URL(trimmed, SITE_PUBLIC_ORIGIN);
      let path = u.pathname || '/';
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return `${SITE_PUBLIC_ORIGIN}${path}${u.search}`;
    } catch {
      return `${SITE_PUBLIC_ORIGIN}/`;
    }
  }

  private toAbsoluteUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (!isPlatformBrowser(this.platformId)) return value;
    const origin = this.doc.defaultView?.location?.origin || '';
    return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`;
  }

  /**
   * Update SEO for a predefined page key (home, menu, about, contact).
   * Use in route components on init.
   */
  updatePage(pageKey: keyof typeof SEO_PAGES): void {
    const tags = SEO_PAGES[pageKey];
    if (tags) {
      this.updateTags(tags);
    }
  }

  /**
   * Reset to default site title and description (e.g. when leaving a page).
   */
  resetToDefaults(): void {
    this.title.setTitle(this.defaultTitle);
    this.meta.updateTag({ name: 'description', content: this.defaultDescription });
    this.meta.updateTag({ name: 'keywords', content: SITE_DEFAULT_SEO_KEYWORDS });
    this.meta.updateTag({ property: 'og:title', content: this.defaultTitle });
    this.meta.updateTag({ property: 'og:description', content: this.defaultDescription });
  }
}
