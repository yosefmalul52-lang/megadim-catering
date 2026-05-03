import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthModalService {
  private readonly platformId = inject(PLATFORM_ID);
  private isModalOpenSubject = new BehaviorSubject<boolean>(false);
  public isModalOpen$: Observable<boolean> = this.isModalOpenSubject.asObservable();

  openModal(): void {
    this.isModalOpenSubject.next(true);
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(): void {
    this.isModalOpenSubject.next(false);
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  get isModalOpen(): boolean {
    return this.isModalOpenSubject.value;
  }
}

