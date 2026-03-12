import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-banner.component.html',
  styleUrls: ['./page-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageBannerComponent {
  @Input() message: string | null | undefined = null;
}
