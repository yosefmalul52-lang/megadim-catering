import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

// Debug: Verify interceptor is imported
console.log('🔧 Main.ts: Auth Interceptor imported:', typeof authInterceptor);
console.log('🔧 Main.ts: Auth Interceptor function:', authInterceptor);

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    // Register HTTP client with interceptors
    // Strictly following Angular Standalone API for HttpClient
    // Order: withInterceptors first, then withFetch
    provideHttpClient(
      withInterceptors([authInterceptor]), // Register auth interceptor - MUST be an array
      withFetch() // Use fetch API instead of XMLHttpRequest
    ),
    provideAnimations(), // Angular Material animations
    // Configure Toastr with Luxury Theme
    provideToastr({
      timeOut: 4000,
      positionClass: 'toast-top-left', // RTL support
      preventDuplicates: true,
      closeButton: true,
      progressBar: true,
      enableHtml: true,
      tapToDismiss: true,
      maxOpened: 3,
      autoDismiss: true
    })
  ]
}).catch(err => console.error(err));
