import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

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
    title: 'Our Menu - Delicious Homemade Food | תפריט מגדים',
    description: 'Explore our ready-for-Shabbat and holiday menu. Salads, main courses, fish, sides and desserts. אוכל מוכן לשבת וחג – סלטים, מנות עיקריות, דגים, תוספות ומנות אחרונות.'
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

  private readonly defaultTitle = 'מגדים - קייטרינג כשר ברמה אחרת';
  private readonly defaultDescription = 'מגדים - שירותי קייטרינג כשר מפוקח ברמה אחרת. אירועים, שבתות וחגים. אוכל ביתי ברמת שף.';

  /**
   * Update document title and meta tags (description, keywords, og, etc.).
   * Call this from each page component in ngOnInit.
   */
  updateTags(tags: SeoTags): void {
    if (tags.title) {
      this.title.setTitle(tags.title);
    }
    if (tags.description) {
      this.meta.updateTag({ name: 'description', content: tags.description });
    }
    if (tags.keywords) {
      this.meta.updateTag({ name: 'keywords', content: tags.keywords });
    }
    if (tags.image) {
      this.meta.updateTag({ property: 'og:image', content: tags.image });
    }
    if (tags.url) {
      this.meta.updateTag({ property: 'og:url', content: tags.url });
    }
    if (tags.title) {
      this.meta.updateTag({ property: 'og:title', content: tags.title });
    }
    if (tags.description) {
      this.meta.updateTag({ property: 'og:description', content: tags.description });
    }
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
  }
}
