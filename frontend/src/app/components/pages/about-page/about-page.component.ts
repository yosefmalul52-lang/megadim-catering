import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SeoService } from '../../../services/seo.service';

interface AboutStat {
  value: string;
  label: string;
}

interface AboutPillar {
  icon: string;
  index: string;
  title: string;
  text: string;
}

interface AboutMilestone {
  year: string;
  title: string;
  text: string;
}

interface AboutService {
  route: string;
  icon: string;
  number: string;
  title: string;
  text: string;
  image: string;
  featured?: boolean;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, MatIconModule, RouterLink],
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.scss'],
})
export class AboutPageComponent implements OnInit {
  private seoService = inject(SeoService);

  readonly stats: AboutStat[] = [
    { value: '5.0', label: 'דירוג בגוגל' },
    { value: 'מאות', label: 'לקוחות מרוצים' },
    { value: '100%', label: 'מחויבות לאיכות' },
  ];

  readonly pillars: AboutPillar[] = [
    {
      icon: 'verified',
      index: '01',
      title: 'כשר למהדרין',
      text: 'פיקוח צמוד ונהלים מחמירים — שקט נפשי מלא בכל הזמנה.',
    },
    {
      icon: 'eco',
      index: '02',
      title: 'טריות ללא פשרות',
      text: 'חומרי גלם נבחרים, מוכנים בקפידה ומגיעים בזמן.',
    },
    {
      icon: 'favorite',
      index: '03',
      title: 'טעם של בית',
      text: 'מסורת ביתית ברמה מקצועית — מנות שמרגישות מוכרות.',
    },
    {
      icon: 'groups',
      index: '04',
      title: 'שירות אישי',
      text: 'צוות שמקשיב, מתאים ודואג לכל פרט באירוע שלכם.',
    },
  ];

  readonly milestones: AboutMilestone[] = [
    {
      year: 'התחלה',
      title: 'אהבה למטבח הביתי',
      text: 'מגדים נולד מתוך תשוקה להביא טעמים אותנטיים מהבית — לשולחן שלכם.',
    },
    {
      year: 'היום',
      title: 'קייטרינג בוטיק מלא',
      text: 'משפחות, אירועים ומוסדות — פתרון קולינרי כשר ומקצועי תחת קורת גג אחת.',
    },
    {
      year: 'תמיד',
      title: 'מחויבות לכל מנה',
      text: 'כל הזמנה מטופלת בקפידה, בטריות ובאהבה — כאילו מדובר באירוע של המשפחה שלנו.',
    },
  ];

  readonly services: AboutService[] = [
    {
      route: '/ready-for-shabbat',
      icon: 'restaurant',
      number: '01',
      title: 'השבת של מגדים',
      text: 'אוכל מוכן לשבת ברמה אחרת. קחו הביתה את הטעמים שלנו — חמים, נדיבים ומוכנים להגשה.',
      image: 'v1773065908/sj-objio-tXM6dMQmMzk-unsplash_bzi656.jpg',
      featured: true,
    },
    {
      route: '/catering',
      icon: 'celebration',
      number: '02',
      title: 'אירועים עם נשמה',
      text: 'אירועי בוטיק או חגיגות גדולות, עם תפריט שמשלב טעמים ביתיים.',
      image: 'v1773064427/silvia-mara-y0u7nji4uXY-unsplash_pzymeb.jpg',
    },
    {
      route: '/holiday-food',
      icon: 'business_center',
      number: '03',
      title: 'מענה למוסדות וחגים',
      text: 'ארוחות מזינות, טריות ובריאות — לשבת, לחג ולכל השבוע.',
      image: 'v1773063956/pen_ash-9qWhN2Nnl0g-unsplash_b4yrtk.jpg',
    },
  ];

  ngOnInit(): void {
    this.seoService.updatePage('about');
  }
}
