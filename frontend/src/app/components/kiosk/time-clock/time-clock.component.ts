import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { interval, Subscription } from 'rxjs';

interface ClockResponse {
  success: boolean;
  data: {
    employee: {
      _id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      role: string;
    };
    attendance: any;
    action: 'in' | 'out';
    clockTime: Date;
  };
  message: string;
}

@Component({
  selector: 'app-time-clock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="time-clock-kiosk" [class.success-green]="showSuccessGreen" [class.success-orange]="showSuccessOrange" [class.error-shake]="isErrorShown">
      <div class="kiosk-container">
        <!-- Current Time Display -->
        <div class="time-display">
          <div class="digital-clock">{{ currentTime }}</div>
          <div class="date-display">{{ currentDate }}</div>
        </div>

        <!-- Status Message Area -->
        <div class="status-message" [class.show]="statusMessage">
          <div class="message-content" [class.success]="statusMessageType === 'success'" [class.error]="statusMessageType === 'error'">
            <i [class]="statusIcon"></i>
            <span>{{ statusMessage }}</span>
          </div>
        </div>

        <!-- PIN Display -->
        <div class="pin-display">
          <div class="pin-dots">
            <span *ngFor="let dot of pinDots" class="pin-dot" [class.filled]="dot"></span>
          </div>
        </div>

        <!-- Keypad -->
        <div class="keypad">
          <button 
            *ngFor="let num of keypadNumbers" 
            class="keypad-btn number-btn"
            (click)="addDigit(num)"
            [disabled]="isProcessing || pinCode.length >= 4">
            {{ num }}
          </button>
          
          <button class="keypad-btn clear-btn" (click)="clearPin()" [disabled]="isProcessing || pinCode.length === 0">
            <i class="fas fa-backspace"></i>
            נקה
          </button>
          
          <button class="keypad-btn enter-btn" (click)="submitPin()" [disabled]="isProcessing || pinCode.length !== 4">
            <i class="fas fa-check"></i>
            אישור
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .time-clock-kiosk {
      min-height: 100vh;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      transition: background-color 0.5s ease;
    }

    .time-clock-kiosk.success-green {
      background: #10b981;
      animation: flashGreen 1s ease;
    }

    .time-clock-kiosk.success-orange {
      background: #f59e0b;
      animation: flashOrange 1s ease;
    }

    .time-clock-kiosk.error-shake {
      animation: shake 0.5s ease;
    }

    @keyframes flashGreen {
      0%, 100% { background: #1e293b; }
      50% { background: #10b981; }
    }

    @keyframes flashOrange {
      0%, 100% { background: #1e293b; }
      50% { background: #f59e0b; }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-20px); }
      75% { transform: translateX(20px); }
    }

    .kiosk-container {
      width: 100%;
      max-width: 800px;
      text-align: center;
    }

    /* Time Display */
    .time-display {
      margin-bottom: 3rem;
    }

    .digital-clock {
      font-size: 8rem;
      font-weight: 700;
      color: white;
      font-family: 'Courier New', monospace;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      margin-bottom: 1rem;
      letter-spacing: 0.1em;
    }

    .date-display {
      font-size: 1.5rem;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 600;
    }

    /* Status Message */
    .status-message {
      min-height: 80px;
      margin-bottom: 2rem;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .status-message.show {
      opacity: 1;
    }

    .message-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.5rem 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-size: 1.5rem;
      font-weight: 600;
      color: white;
      backdrop-filter: blur(10px);
    }

    .message-content.success {
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10b981;
    }

    .message-content.error {
      background: rgba(239, 68, 68, 0.2);
      border: 2px solid #ef4444;
    }

    .message-content i {
      font-size: 2rem;
    }

    /* PIN Display */
    .pin-display {
      margin-bottom: 3rem;
    }

    .pin-dots {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }

    .pin-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      transition: all 0.3s ease;
    }

    .pin-dot.filled {
      background: white;
      border-color: white;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
    }

    /* Keypad */
    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      max-width: 500px;
      margin: 0 auto;
    }

    .keypad-btn {
      aspect-ratio: 1;
      border: none;
      border-radius: 16px;
      font-size: 2rem;
      font-weight: 700;
      color: white;
      background: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 0.5rem;
    }

    .keypad-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.05);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }

    .keypad-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .keypad-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .number-btn {
      font-size: 2.5rem;
    }

    .clear-btn,
    .enter-btn {
      font-size: 1.25rem;
      grid-column: span 1;
    }

    .enter-btn {
      background: rgba(16, 185, 129, 0.3);
      border-color: #10b981;
    }

    .enter-btn:hover:not(:disabled) {
      background: rgba(16, 185, 129, 0.5);
    }

    .clear-btn {
      background: rgba(239, 68, 68, 0.3);
      border-color: #ef4444;
    }

    .clear-btn:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.5);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .digital-clock {
        font-size: 5rem;
      }

      .date-display {
        font-size: 1.25rem;
      }

      .keypad {
        gap: 0.75rem;
      }

      .keypad-btn {
        font-size: 1.5rem;
      }

      .number-btn {
        font-size: 2rem;
      }
    }
  `]
})
export class TimeClockComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private timeSubscription?: Subscription;

  currentTime = '00:00';
  currentDate = '';
  pinCode = '';
  isProcessing = false;
  statusMessage = '';
  statusMessageType: 'success' | 'error' | '' = '';
  statusIcon = '';
  showSuccessGreen = false;
  showSuccessOrange = false;
  isErrorShown = false;

  keypadNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  get pinDots(): boolean[] {
    return Array(4).fill(false).map((_, i) => i < this.pinCode.length);
  }

  ngOnInit(): void {
    this.updateTime();
    this.updateDate();
    
    // Update time every second
    this.timeSubscription = interval(1000).subscribe(() => {
      this.updateTime();
      this.updateDate();
    });
  }

  ngOnDestroy(): void {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }

  updateTime(): void {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.currentTime = `${hours}:${minutes}`;
  }

  updateDate(): void {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    this.currentDate = now.toLocaleDateString('he-IL', options);
  }

  addDigit(digit: number): void {
    if (this.pinCode.length < 4 && !this.isProcessing) {
      this.pinCode += digit.toString();
      this.clearStatus();
    }
  }

  clearPin(): void {
    if (!this.isProcessing) {
      this.pinCode = '';
      this.clearStatus();
    }
  }

  submitPin(): void {
    if (this.pinCode.length !== 4 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.clearStatus();

    const url = `${environment.apiUrl}/attendance/clock`;
    
    this.http.post<ClockResponse>(url, { pinCode: this.pinCode }).subscribe({
      next: (response) => {
        if (response.success) {
          const employee = response.data.employee;
          const action = response.data.action;
          const clockTime = new Date(response.data.clockTime);
          const timeStr = clockTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

          if (action === 'in') {
            this.showSuccess('בוקר טוב, ' + employee.firstName + '! נכנסת ב-' + timeStr, 'success', 'fas fa-check-circle');
            this.showSuccessGreen = true;
            setTimeout(() => {
              this.showSuccessGreen = false;
            }, 1000);
          } else {
            this.showSuccess('להתראות, ' + employee.firstName + '! יצאת ב-' + timeStr, 'success', 'fas fa-sign-out-alt');
            this.showSuccessOrange = true;
            setTimeout(() => {
              this.showSuccessOrange = false;
            }, 1000);
          }

          // Clear PIN after 2 seconds
          setTimeout(() => {
            this.pinCode = '';
            this.clearStatus();
            this.isProcessing = false;
          }, 2000);
        } else {
          this.displayError('קוד שגוי');
          this.isProcessing = false;
        }
      },
      error: (error) => {
        console.error('❌ Error clocking:', error);
        this.displayError('קוד שגוי');
        this.isProcessing = false;
      }
    });
  }

  showSuccess(message: string, type: 'success', icon: string): void {
    this.statusMessage = message;
    this.statusMessageType = type;
    this.statusIcon = icon;
  }

  displayError(message: string): void {
    this.statusMessage = message;
    this.statusMessageType = 'error';
    this.statusIcon = 'fas fa-times-circle';
    this.isErrorShown = true;
    
    setTimeout(() => {
      this.isErrorShown = false;
    }, 500);
    
    // Clear PIN on error
    setTimeout(() => {
      this.pinCode = '';
      this.clearStatus();
    }, 2000);
  }

  clearStatus(): void {
    this.statusMessage = '';
    this.statusMessageType = '';
    this.statusIcon = '';
  }
}

