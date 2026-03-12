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

/** Predefined SEO presets for main pages (Magadim Catering) */
export const SEO_PAGES: Record<string, SeoTags> = {
  home: {
    title: 'Magadim Catering - Premium Events | מגדים קייטרינג',
    description: 'Premium kosher catering for events, Shabbat and holidays. Homemade quality, delivered to you. קייטרינג כשר למהדרין לאירועים, שבתות וחגים.',
    keywords: 'קייטרינג כשר, אוכל לשבת, צ\'ולנט, אירועים, כשרות מפוקחת, מגדים'
  },
  menu: {
    title: 'תפריט מוכן לשבת - קייטרינג מגדים | סלטים, דגים, מנות עיקריות, קינוחים',
    description: 'מגוון מנות מוכנות לשבת: סלטים טריים, דגים, מנות עיקריות, תוספות וממולאים, קינוחים. הזמינו אוכל כשר לשבת.',
    image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906611/IMG_9750_v7mval.jpg'
  },
  about: {
    title: 'About Magadim Catering | אודות מגדים',
    description: 'Learn about Magadim – premium kosher catering with a passion for quality and tradition. אודות מגדים – קייטרינג כשר ברמה אחרת.'
  },
  contact: {
    title: 'Contact Magadim Catering | צור קשר',
    description: 'Get in touch with Magadim Catering for events, tastings and quotes. צור קשר עם מגדים להזמנות, טעימות והצעות מחיר.'
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

  private readonly defaultTitle = 'מגדים - קייטרינג כשר ברמה אחרת';
  private readonly defaultDescription = 'מגדים - שירותי קייטרינג כשר מפוקח ברמה אחרת. אירועים, שבתות וחגים. אוכל ביתי ברמת שף.';

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
    const pageUrl = config.url || (isPlatformBrowser(this.platformId) ? this.doc.defaultView?.location?.href : undefined);
    if (pageUrl) {
      this.meta.updateTag({ property: 'og:url', content: pageUrl });
      this.setCanonical(pageUrl);
    }
  }

  /** Set or update the canonical link to prevent duplicate content. */
  setCanonical(url: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const head = this.doc.getElementsByTagName('head')[0];
    if (!head) return;
    let link = head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
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
    this.meta.updateTag({ property: 'og:title', content: this.defaultTitle });
    this.meta.updateTag({ property: 'og:description', content: this.defaultDescription });
  }
}
