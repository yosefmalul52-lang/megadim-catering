import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { SeoService } from '../../../services/seo.service';
import { FeaturedMenuComponent } from '../../featured-menu/featured-menu.component';
import { VideoSectionComponent } from '../../video-section/video-section.component';
import { LocaleService } from '../../../i18n/locale.service';
import { localizeNavPath } from '../../../i18n/locale.util';

interface HomeServicePath {
  route: string;
  image: string;
  titleKey: string;
  altKey: string;
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
    TranslateModule,
    FeaturedMenuComponent,
    VideoSectionComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly seoService = inject(SeoService);
  private readonly translate = inject(TranslateService);
  readonly localeService = inject(LocaleService);

  @ViewChild('heroTitleMeasure') heroTitleMeasure?: ElementRef<HTMLElement>;

  featuredReviewIndex = 0;
  private featuredReviewTimer?: ReturnType<typeof setInterval>;
  private heroTypingTimer?: ReturnType<typeof setTimeout>;
  private langChangeSub?: Subscription;

  heroTitleFull = '';
  heroTitleLines: string[] = [''];
  heroTitleTypedLines: string[] = [''];
  heroTitleDone = false;

  readonly heroTrustKeys = [
    'HOME.TRUST_1',
    'HOME.TRUST_2',
    'HOME.TRUST_3',
    'HOME.TRUST_4',
  ];

  readonly servicePaths: HomeServicePath[] = [
    {
      route: '/ready-for-shabbat',
      image: 'assets/images/shabbat-holiday-catering.png',
      titleKey: 'HOME.PATH_READY_TITLE',
      altKey: 'HOME.PATH_READY_ALT',
      imagePosition: 'center',
    },
    {
      route: '/catering',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/c3bad83038c1d880/original.jpg',
      titleKey: 'HOME.PATH_EVENTS_TITLE',
      altKey: 'HOME.PATH_EVENTS_ALT',
      imagePosition: 'top center',
      featured: true,
    },
    {
      route: '/shabbat-events',
      image: 'assets/images/ready-for-shabbat-home.png',
      titleKey: 'HOME.PATH_HOLIDAY_TITLE',
      altKey: 'HOME.PATH_HOLIDAY_ALT',
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
    this.refreshHeroTitle();
    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      this.resetHeroTyping();
    });

    this.featuredReviewTimer = setInterval(() => {
      this.featuredReviewIndex = (this.featuredReviewIndex + 1) % this.testimonials.length;
    }, 6500);
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.beginHeroTyping());
  }

  ngOnDestroy(): void {
    if (this.heroTypingTimer) {
      clearTimeout(this.heroTypingTimer);
    }

    if (this.featuredReviewTimer) {
      clearInterval(this.featuredReviewTimer);
    }

    this.langChangeSub?.unsubscribe();
  }

  navPath(path: string): string {
    return localizeNavPath(path, this.localeService.locale);
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

  private refreshHeroTitle(): void {
    this.heroTitleFull = this.translate.instant('HOME.HERO_TITLE');
  }

  private resetHeroTyping(): void {
    this.refreshHeroTitle();
    if (this.heroTypingTimer) {
      clearTimeout(this.heroTypingTimer);
      this.heroTypingTimer = undefined;
    }
    requestAnimationFrame(() => this.beginHeroTyping());
  }

  private beginHeroTyping(): void {
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
}
