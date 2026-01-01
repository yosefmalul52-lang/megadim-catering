import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../../services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" *ngIf="toasts.length > 0">
      <div 
        *ngFor="let toast of toasts; trackBy: trackByToastId"
        class="toast"
        [class.toast-success]="toast.type === 'success'"
        [class.toast-error]="toast.type === 'error'"
        [class.toast-info]="toast.type === 'info'"
        [class.toast-warning]="toast.type === 'warning'"
      >
        <div class="toast-icon">
          <i 
            class="fas"
            [class.fa-check-circle]="toast.type === 'success'"
            [class.fa-exclamation-circle]="toast.type === 'error'"
            [class.fa-info-circle]="toast.type === 'info'"
            [class.fa-exclamation-triangle]="toast.type === 'warning'"
            aria-hidden="true"
          ></i>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
        <button 
          class="toast-close"
          (click)="removeToast(toast.id)"
          [attr.aria-label]="'סגור'"
          type="button"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      direction: rtl;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      animation: slideInRight 0.3s ease-out;
      border-right: 4px solid;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      border-color: #28a745;
      background: linear-gradient(135deg, #ffffff 0%, #f0f9f4 100%);
    }

    .toast-error {
      border-color: #dc3545;
      background: linear-gradient(135deg, #ffffff 0%, #fff5f5 100%);
    }

    .toast-info {
      border-color: #17a2b8;
      background: linear-gradient(135deg, #ffffff 0%, #f0f9fb 100%);
    }

    .toast-warning {
      border-color: #ffc107;
      background: linear-gradient(135deg, #ffffff 0%, #fffbf0 100%);
    }

    .toast-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .toast-success .toast-icon {
      color: #28a745;
    }

    .toast-error .toast-icon {
      color: #dc3545;
    }

    .toast-info .toast-icon {
      color: #17a2b8;
    }

    .toast-warning .toast-icon {
      color: #ffc107;
    }

    .toast-message {
      flex: 1;
      font-size: 0.9375rem;
      font-weight: 500;
      color: #0E1A24;
      line-height: 1.5;
    }

    .toast-close {
      background: transparent;
      border: none;
      color: #6c757d;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      flex-shrink: 0;
      font-size: 0.875rem;

      &:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #0E1A24;
      }
    }

    @media (max-width: 768px) {
      .toast-container {
        top: 10px;
        left: 10px;
        right: 10px;
      }

      .toast {
        min-width: auto;
        max-width: 100%;
      }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  toasts: ToastMessage[] = [];

  ngOnInit(): void {
    this.toastService.toasts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(toasts => {
        this.toasts = toasts;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  removeToast(id: string): void {
    this.toastService.remove(id);
  }

  trackByToastId(index: number, toast: ToastMessage): string {
    return toast.id;
  }
}

