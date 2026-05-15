import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type QuantitySelectorMode = 'unit' | 'weight';

/** Inline +/- quantity control for product cards (units or 100g steps). */
@Component({
  selector: 'app-quantity-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quantity-selector.component.html',
  styleUrls: ['./quantity-selector.component.scss']
})
export class QuantitySelectorComponent {
  @Input() mode: QuantitySelectorMode = 'unit';
  @Input() value = 1;
  @Input() min = 1;
  @Input() max = 99;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<number>();

  get displayValue(): string {
    if (this.mode === 'weight') {
      return `${this.value * 100} גרם`;
    }
    return String(this.value);
  }

  decrease(): void {
    if (this.disabled || this.value <= this.min) return;
    this.emit(this.value - 1);
  }

  increase(): void {
    if (this.disabled || this.value >= this.max) return;
    this.emit(this.value + 1);
  }

  onInputChange(event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10);
    if (!Number.isFinite(raw)) return;
    const next = Math.min(this.max, Math.max(this.min, raw));
    this.emit(next);
  }

  private emit(next: number): void {
    this.valueChange.emit(next);
  }
}
