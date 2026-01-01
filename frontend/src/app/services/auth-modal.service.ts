import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthModalService {
  private isModalOpenSubject = new BehaviorSubject<boolean>(false);
  public isModalOpen$: Observable<boolean> = this.isModalOpenSubject.asObservable();

  openModal(): void {
    this.isModalOpenSubject.next(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.isModalOpenSubject.next(false);
    // Restore body scroll
    document.body.style.overflow = '';
  }

  get isModalOpen(): boolean {
    return this.isModalOpenSubject.value;
  }
}

