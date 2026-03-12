import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const POPUP_DISMISSED_KEY = 'popupDismissed';

@Component({
  selector: 'app-page-popup',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './page-popup.component.html',
  styleUrls: ['./page-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PagePopupComponent implements OnInit {
  @Input() title: string = '';
  @Input() text: string = '';
  @Input() linkText: string = '';
  @Input() linkUrl: string = '';
  @Input() set show(value: boolean) {
    this._show = value;
    this.updateEffectiveShow();
  }
  get show(): boolean {
    return this._show;
  }
  private _show = false;

  /** True only when show is true and user has not dismissed the popup this session. */
  effectiveShow = false;

  @Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    this.updateEffectiveShow();
  }

  private updateEffectiveShow(): void {
    const isPopupDismissed = sessionStorage.getItem(POPUP_DISMISSED_KEY) === 'true';
    this.effectiveShow = this._show && !isPopupDismissed;
  }

  closePopup(): void {
    sessionStorage.setItem(POPUP_DISMISSED_KEY, 'true');
    this.effectiveShow = false;
    this.close.emit();
  }

  onOverlayClick(): void {
    this.closePopup();
  }

  onBoxClick(event: Event): void {
    event.stopPropagation();
  }
}
