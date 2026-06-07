import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { SeoService } from '../../../services/seo.service';
import { FeaturedMenuComponent } from '../../featured-menu/featured-menu.component';
import { AboutComponent } from '../../about/about.component';
import { VideoSectionComponent } from '../../video-section/video-section.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';

interface HomeServiceCard {
  route: string;
  image: string;
  alt: string;
  lineWhite: string;
  lineGold: string;
  imagePosition: string;
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
    AboutComponent,
    VideoSectionComponent,
    PagePopupComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly settingsService = inject(SiteSettingsService);
  private readonly seoService = inject(SeoService);

  settings: SiteSettings | null = null;
  showPopup = false;

  featuredReviewIndex = 0;
  reviewsAccentVisible = false;
  private featuredReviewTimer?: ReturnType<typeof setInterval>;
  private reviewsAccentObserver?: IntersectionObserver;

  @ViewChild('reviewsTitleWrap') reviewsTitleWrap?: ElementRef<HTMLElement>;

  readonly heroTitleFull = 'קייטרינג ברמה אחרת';
  heroTitleDisplayed = '';
  heroTitleComplete = false;
  private heroTitleStartTimer?: ReturnType<typeof setTimeout>;
  private heroTitleTimer?: ReturnType<typeof setInterval>;

  readonly serviceCards: HomeServiceCard[] = [
    {
      route: '/ready-for-shabbat',
      image: 'v1773065908/sj-objio-tXM6dMQmMzk-unsplash_bzi656.jpg',
      alt: 'אוכל מוכן לשבת וחג – מנות ביתיות ובשר כשר למהדרין | קייטרינג מגדים',
      lineWhite: 'הזמנה נוחה עד הבית',
      lineGold: 'אוכל מוכן לשבת וחג',
      imagePosition: 'center',
    },
    {
      route: '/catering',
      image: 'v1773064427/silvia-mara-y0u7nji4uXY-unsplash_pzymeb.jpg',
      alt: 'קייטרינג לאירועים – תפריט בשרי כשר למהדרין ושולחן חגיגי | קייטרינג מגדים',
      lineWhite: 'לכל אירוע מיוחד',
      lineGold: 'קייטרינג לאירועים',
      imagePosition: 'top center',
    },
    {
      route: '/shabbat-events',
      image: 'v1773063956/pen_ash-9qWhN2Nnl0g-unsplash_b4yrtk.jpg',
      alt: 'קייטרינג לשבת חתן ואירועי שבת וחג – מנות חמות וכשרות למהדרין | קייטרינג מגדים',
      lineWhite: 'שבת חתן וחגים',
      lineGold: 'קייטרינג לשבת וחג',
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

    this.startHeroTitleTyping();
  }

  ngAfterViewInit(): void {
    this.setupReviewsAccentObserver();
  }

  ngOnDestroy(): void {
    this.reviewsAccentObserver?.disconnect();

    if (this.featuredReviewTimer) {
      clearInterval(this.featuredReviewTimer);
    }
    if (this.heroTitleStartTimer) {
      clearTimeout(this.heroTitleStartTimer);
    }
    if (this.heroTitleTimer) {
      clearInterval(this.heroTitleTimer);
    }
  }

  private startHeroTitleTyping(): void {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      this.heroTitleDisplayed = this.heroTitleFull;
      this.heroTitleComplete = true;
      return;
    }

    let index = 0;
    const typeDelayMs = 80;
    const startDelayMs = 350;

    this.heroTitleStartTimer = setTimeout(() => {
      this.heroTitleTimer = setInterval(() => {
        if (index < this.heroTitleFull.length) {
          this.heroTitleDisplayed += this.heroTitleFull[index];
          index += 1;
          return;
        }

        this.heroTitleComplete = true;
        if (this.heroTitleTimer) {
          clearInterval(this.heroTitleTimer);
        }
      }, typeDelayMs);
    }, startDelayMs);
  }

  setFeaturedReview(index: number): void {
    this.featuredReviewIndex = index;
  }

  private setupReviewsAccentObserver(): void {
    const el = this.reviewsTitleWrap?.nativeElement;
    if (!el || typeof IntersectionObserver === 'undefined') {
      this.reviewsAccentVisible = true;
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.reviewsAccentVisible = true;
      return;
    }

    this.reviewsAccentObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          this.reviewsAccentVisible = true;
          this.reviewsAccentObserver?.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: '0px 0px -8% 0px' }
    );

    this.reviewsAccentObserver.observe(el);
  }

  closePopup(): void {
    this.showPopup = false;
  }
}
