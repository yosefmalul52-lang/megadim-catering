import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../../i18n/locale.service';

@Component({
  selector: 'app-accessibility',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accessibility.component.html',
  styleUrls: ['./accessibility.component.scss']
})
export class AccessibilityComponent {
  readonly localeService = inject(LocaleService);
}
