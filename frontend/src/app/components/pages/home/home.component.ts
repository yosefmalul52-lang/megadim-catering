import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { SeoService } from '../../../services/seo.service';
import { FeaturedMenuComponent } from '../../featured-menu/featured-menu.component';
import { VideoSectionComponent } from '../../video-section/video-section.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';

interface HomeServicePath {
  route: string;
  image: string;
  alt: string;
  title: string;
  text: string;
  cta: string;
  imagePosition: string;
  featured?: boolean;
}

interface HomeTestimonial {
  name: string;
  location: string;
  text: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    NgOptimizedImage,
    FeaturedMenuComponent,
    VideoSectionComponent,
    PagePopupComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly settingsService = inject(SiteSettingsService);
  private readonly seoService = inject(SeoService);

  @ViewChild('heroTitleMeasure') heroTitleMeasure?: ElementRef<HTMLElement>;

  settings: SiteSettings | null = null;
  showPopup = false;

  featuredReviewIndex = 0;
  private featuredReviewTimer?: ReturnType<typeof setInterval>;
  private heroTypingTimer?: ReturnType<typeof setTimeout>;

  readonly heroTitleFull = 'קייטרינג בשרי כשר למהדרין לאירועים, שבתות וחגים.';
  heroTitleLines: string[] = [this.heroTitleFull];
  heroTitleTypedLines: string[] = [''];
  heroTitleDone = false;

  readonly heroTrustItems = [
    '5.0 בגוגל',
    'מאות לקוחות מרוצים',
    'כשרות מהדרין',
    'משלוחים עד הבית',
  ];

  readonly servicePaths: HomeServicePath[] = [
    {
      route: '/ready-for-shabbat',
      image: 'v1773065908/sj-objio-tXM6dMQmMzk-unsplash_bzi656.jpg',
      alt: 'אוכל מוכן לשבת וחג – מנות ביתיות ובשר כשר למהדרין | קייטרינג מגדים',
      title: 'אוכל מוכן לשבת וחג',
      text: 'מנות עשירות ומוכנות להגשה לשולחן שבת, חג או אירוח משפחתי.',
      cta: 'לתפריט שבת וחג',
      imagePosition: 'center',
    },
    {
      route: '/catering',
      image: 'v1773064427/silvia-mara-y0u7nji4uXY-unsplash_pzymeb.jpg',
      alt: 'קייטרינג לאירועים – תפריט בשרי כשר למהדרין | קייטרינג מגדים',
      title: 'קייטרינג לאירועים',
      text: 'תפריט בשרי מלא לאירועים משפחתיים, עסקיים ומוסדיים.',
      cta: 'לקבלת הצעה לאירוע',
      imagePosition: 'top center',
      featured: true,
    },
    {
      route: '/shabbat-events',
      image: 'v1773063956/pen_ash-9qWhN2Nnl0g-unsplash_b4yrtk.jpg',
      alt: 'קייטרינג לשבת וחג – כשר למהדרין | קייטרינג מגדים',
      title: 'קייטרינג לשבת וחג',
      text: 'קייטרינג מלא לשבתות, חגים ואירועי שבת וחג עם תפריט מותאם.',
      cta: 'לקבלת הצעה לשבת וחג',
      imagePosition: 'center',
    },
  ];

  readonly testimonials: HomeTestimonial[] = [
    {
      name: 'משפחת כהן',
      location: 'ירושלים',
      text: 'הזמנו קייטרינג לשבת חתן עם מעל מאה אורחים, והאוכל הגיע חם, מסודר וארוז בצורה מכבדת ואסתטית. כבר מהרגע הראשון הרגשנו שמדובר בצוות מקצועי שחושב על כל פרט קטן, מהסדר על השולחן ועד הטעמים שמגיעים בדיוק בזמן. הטעם היה ביתי ומדויק, המנות נדיבות, והאורחים שלנו לא הפסיקו לשאול מאיפה הזמנו. כבר בערב עצמו קיבלנו שיחות ומחמאות ממשפחה ומחברים, וזו הייתה חוויה שממש הרגישה כמו אירוע פרימיום.',
    },
    {
      name: 'דוד לוי',
      location: 'בני ברק',
      text: 'אנחנו לקוחות קבועים של מגדים לשבתות, וכל פעם מחדש האיכות מפתיעה אותנו לטובה. הצ\'ולנט עשיר ועמוק בטעם, הסלטים טריים ומאוזנים, והמנות העיקריות מגיעות בדיוק כמו שאוהבים אותן בבית — רק ברמה גבוהה יותר. הכול מגיע בזמן, בכמות נדיבה ובאריזה מסודרת שחוסכת לנו עבודה לפני שבת. זה נותן לנו שקט נפשי אמיתי, בלי לרוץ במטבח ובלי להתפשר על טעם ביתי.',
    },
    {
      name: 'רחלי א.',
      location: 'פתח תקווה',
      text: 'הזמנתי ברגע האחרון לערב חג משפחתי, וקיבלתי מענה מהיר, אדיב ומקצועי מהצוות שעזר לי לבחור בדיוק את מה שמתאים לכמות האורחים. האוכל הגיע בדיוק כפי שהבטיחו, חם, מוכן להגשה ונראה מצוין על השולחן. האורחים לא הפסיקו לשאול מאיפה הזמנו, והילדים ביקשו שנזמין שוב כבר לשבת הבאה. השילוב בין שירות אישי לבין רמה קולינרית גבוהה הפך את האירוע למוצלח במיוחד.',
    },
    {
      name: 'אבי ו.',
      location: 'מודיעין',
      text: 'הזמנו קייטרינג לברית עם משפחה וחברים, והכל הגיע בזמן, מסודר וברמה גבוהה שעמדה בכל הציפיות. המנות העיקריות, התוספות והסלטים קיבלו מחמאות מכל הכיוונים, וההגשה נראתה מצוינת גם בתמונות ששלחנו למשפחה. מרגישים שמדובר במטבח שמכבד כל לקוח, גם כשמדובר באירוע אינטימי ולא רק באירוע ענק. יצאנו עם תחושה של ביטחון מלא לגבי הכשרות, הטריות והשירות.',
    },
    {
      name: 'מירב ג.',
      location: 'גבעת שמואל',
      text: 'אוכל ביתי ברמה גבוהה מאוד — התיבול מדויק, המנות נדיבות והשירות תמיד עם חיוך וסבלנות גם כשיש שינויים ברגע האחרון. אנחנו מזמינים גם לשבתות שקטות וגם לאירועים גדולים יותר, ובכל פעם החוויה עקבית, אמינה ונעימה. הילדים אוהבים את הטעמים המוכרים, והאורחים תמיד שואלים על המקור. זו בדיוק הסיבה שחוזרים למגדים שוב ושוב, כי אפשר לסמוך עליהם בלי הפתעות.',
    },
    {
      name: 'רוני ס.',
      location: 'רמת גן',
      text: 'פתרון מושלם לשבת עמוסה: במקום לעמוד שעות במטבח, מזמינים ממגדים ונהנים מאוכל שמרגיש כמו של בית — רק ברמה מקצועית ומסודרת. הילדים אוהבים, האורחים מרוצים, ואנחנו סוף סוף יכולים להתפנות למשפחה בלי לחץ. גם כשמזמינים כמויות גדולות, האיכות לא יורדת והכול מגיע בזמן. ממליצים בחום לכל מי שמחפש איכות, כשרות ושקט נפשי לפני כל שבת וחג.',
    },
  ];

  ngOnInit(): void {
    this.seoService.updatePage('home');
    this.settingsService.getSettings(true).subscribe((s) => {
      this.settings = s;
      const home = this.settings?.pageAnnouncements?.['home'];
      const hasTitle = (home?.popupTitle?.trim() ?? '') !== '';
      const hasText = (home?.popupText?.trim() ?? '') !== '';
      if (hasTitle || hasText) {
        this.showPopup = true;
      }
    });

    this.featuredReviewTimer = setInterval(() => {
      this.featuredReviewIndex = (this.featuredReviewIndex + 1) % this.testimonials.length;
    }, 6500);
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      this.heroTitleLines = this.splitTitleIntoLines();

      if (
        typeof window === 'undefined' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        this.heroTitleTypedLines = [...this.heroTitleLines];
        this.heroTitleDone = true;
        return;
      }

      this.heroTitleTypedLines = [''];
      this.heroTitleDone = false;
      this.startHeroTyping();
    });
  }

  ngOnDestroy(): void {
    if (this.heroTypingTimer) {
      clearTimeout(this.heroTypingTimer);
    }

    if (this.featuredReviewTimer) {
      clearInterval(this.featuredReviewTimer);
    }
  }

  setFeaturedReview(index: number): void {
    this.featuredReviewIndex = index;
  }

  splitReviewParagraphs(text: string): [string, string] {
    const trimmed = text.trim();
    const allSentences =
      trimmed.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
    const sentences = allSentences.length ? allSentences.slice(0, 4) : [trimmed];

    if (sentences.length >= 2) {
      const mid = Math.ceil(sentences.length / 2);
      return [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')];
    }

    const midpoint = Math.floor(trimmed.length / 2);
    const splitAt = trimmed.lastIndexOf(' ', midpoint);
    if (splitAt > 0) {
      return [trimmed.slice(0, splitAt).trim(), trimmed.slice(splitAt).trim()];
    }

    return [trimmed, ''];
  }

  private splitTitleIntoLines(): string[] {
    const el = this.heroTitleMeasure?.nativeElement;
    if (!el || typeof document === 'undefined') {
      return [this.heroTitleFull];
    }

    const text = this.heroTitleFull;
    const textNode = el.firstChild;

    if (!textNode || textNode.nodeType !== Node.TEXT_NODE || text.length === 0) {
      return [text];
    }

    const range = document.createRange();
    const lines: string[] = [];
    let lineStart = 0;
    let previousTop: number | null = null;

    for (let i = 0; i < text.length; i += 1) {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) {
        continue;
      }

      if (previousTop !== null && Math.abs(rect.top - previousTop) > 4) {
        lines.push(text.slice(lineStart, i));
        lineStart = i;
      }

      previousTop = rect.top;
    }

    lines.push(text.slice(lineStart));
    return lines.length > 0 ? lines : [text];
  }

  private buildTypedLines(activeLineIndex: number, activeCharIndex: number): string[] {
    return this.heroTitleLines.slice(0, activeLineIndex + 1).map((line, index) => {
      if (index < activeLineIndex) {
        return line;
      }
      return line.slice(0, activeCharIndex);
    });
  }

  private startHeroTyping(): void {
    let lineIndex = 0;
    let charIndex = 0;

    const typeNext = (): void => {
      if (lineIndex >= this.heroTitleLines.length) {
        this.heroTitleDone = true;
        this.heroTitleTypedLines = [...this.heroTitleLines];
        return;
      }

      const currentLine = this.heroTitleLines[lineIndex];

      if (charIndex < currentLine.length) {
        charIndex += 1;
        this.heroTitleTypedLines = this.buildTypedLines(lineIndex, charIndex);
        const char = currentLine[charIndex - 1];
        const delay = char === ',' ? 120 : char === ' ' ? 45 : 38;
        this.heroTypingTimer = setTimeout(typeNext, delay);
        return;
      }

      lineIndex += 1;
      charIndex = 0;

      if (lineIndex < this.heroTitleLines.length) {
        this.heroTitleTypedLines = this.buildTypedLines(lineIndex, 0);
        this.heroTypingTimer = setTimeout(typeNext, 90);
        return;
      }

      this.heroTitleDone = true;
      this.heroTitleTypedLines = [...this.heroTitleLines];
    };

    this.heroTypingTimer = setTimeout(typeNext, 450);
  }

  closePopup(): void {
    this.showPopup = false;
  }
}
