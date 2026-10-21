import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SeoService } from '../../../services/seo.service';
import { LocaleService } from '../../../i18n/locale.service';

interface AboutValue {
  index: string;
  titleKey: string;
  textKey: string;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, RouterLink, TranslateModule],
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.scss'],
})
export class AboutPageComponent implements OnInit {
  private seoService = inject(SeoService);
  readonly localeService = inject(LocaleService);

  readonly closingTrustKeys = [
    'ABOUT.TRUST_KOSHER',
    'ABOUT.TRUST_CHEF',
    'ABOUT.TRUST_DELIVERY',
  ];

  readonly values: AboutValue[] = [
    { index: '01', titleKey: 'ABOUT.V1_TITLE', textKey: 'ABOUT.V1_TEXT' },
    { index: '02', titleKey: 'ABOUT.V2_TITLE', textKey: 'ABOUT.V2_TEXT' },
    { index: '03', titleKey: 'ABOUT.V3_TITLE', textKey: 'ABOUT.V3_TEXT' },
    { index: '04', titleKey: 'ABOUT.V4_TITLE', textKey: 'ABOUT.V4_TEXT' },
  ];

  ngOnInit(): void {
    this.seoService.updatePage('about');
  }
}
