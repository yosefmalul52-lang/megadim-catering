import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-popup',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './page-popup.component.html',
  styleUrls: ['./page-popup.component.scss']
})
export class PagePopupComponent {
  @Input() title: string = '';
  @Input() text: string = '';
  @Input() linkText: string = '';
  @Input() linkUrl: string = '';
  @Input() show: boolean = false;
  @Output() close = new EventEmitter<void>();

  closePopup(): void {
    this.close.emit();
  }

  onOverlayClick(): void {
    this.close.emit();
  }

  onBoxClick(event: Event): void {
    event.stopPropagation();
  }
}
