import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../services/seo.service';

interface AboutValue {
  index: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, RouterLink],
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.scss'],
})
export class AboutPageComponent implements OnInit {
  private seoService = inject(SeoService);

  readonly closingTrustItems = [
    'כשר למהדרין',
    'בהנהלת השף ינון אנקרי',
    'משלוחים עד הבית',
  ];

  readonly values: AboutValue[] = [
    {
      index: '01',
      title: 'כשרות מהדרין',
      text: 'פיקוח ברור והקפדה על כל מנה.',
    },
    {
      index: '02',
      title: 'טעם ביתי ברמה גבוהה',
      text: 'אוכל עשיר, מוכר ומכובד.',
    },
    {
      index: '03',
      title: 'התאמה אישית',
      text: 'תפריט שנבנה לפי האירוע, הקהל והתקציב.',
    },
    {
      index: '04',
      title: 'שירות מסודר',
      text: 'מענה ברור, תיאום מראש והגעה בזמן.',
    },
  ];

  readonly menuFitItems = [
    'כמות האורחים',
    'סגנון האירוע',
    'רמת הכשרות',
    'אופי ההגשה',
  ];

  ngOnInit(): void {
    this.seoService.updatePage('about');
  }
}
