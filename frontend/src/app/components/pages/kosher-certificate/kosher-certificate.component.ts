import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiteSettingsService } from '../../../services/site-settings.service';

@Component({
  selector: 'app-kosher-certificate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kosher-certificate.component.html',
  styleUrls: ['./kosher-certificate.component.scss']
})
export class KosherCertificateComponent implements OnInit {
  private settingsService = inject(SiteSettingsService);

  certificateImageUrl = 'assets/images/Kosher-certificate.jpg';

  ngOnInit(): void {
    this.settingsService.getSettings(true).subscribe({
      next: (settings) => {
        this.certificateImageUrl = this.settingsService.getKosherCertificateUrl(settings);
      }
    });
  }
}
