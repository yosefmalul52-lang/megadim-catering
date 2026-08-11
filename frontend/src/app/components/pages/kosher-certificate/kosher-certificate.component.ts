import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { LocaleService } from '../../../i18n/locale.service';

@Component({
  selector: 'app-kosher-certificate',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './kosher-certificate.component.html',
  styleUrls: ['./kosher-certificate.component.scss']
})
export class KosherCertificateComponent implements OnInit {
  private settingsService = inject(SiteSettingsService);
  readonly localeService = inject(LocaleService);

  certificateImageUrl = 'assets/images/Kosher-certificate.jpg';

  ngOnInit(): void {
    this.settingsService.getSettings(true).subscribe({
      next: (settings) => {
        this.certificateImageUrl = this.settingsService.getKosherCertificateUrl(settings);
      }
    });
  }
}
