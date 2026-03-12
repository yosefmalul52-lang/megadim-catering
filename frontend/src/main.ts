import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { AuthService } from './app/services/auth.service';

const CLOUDINARY_CLOUD_NAME = 'dioklg7lx';

/** Image loader: full URLs and relative paths pass through; otherwise use Cloudinary with optional width. */
function imageLoader(config: ImageLoaderConfig): string {
  const src = config.src;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('assets')) {
    return src;
  }
  const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const transform = config.width ? `w_${config.width},f_auto,q_auto` : 'f_auto,q_auto';
  const path = src.replace(/^\/+/, '');
  return `${base}/${transform}/${path}`;
}

// Custom HttpLoader that implements TranslateLoader
export class CustomHttpLoader implements TranslateLoader {
  constructor(private http: HttpClient, private prefix: string = './assets/i18n/', private suffix: string = '.json') {}

  getTranslation(lang: string): Observable<any> {
    return this.http.get(`${this.prefix}${lang}${this.suffix}`);
  }
}

// Factory function for CustomHttpLoader
export function HttpLoaderFactory(http: HttpClient): TranslateLoader {
  return new CustomHttpLoader(http, './assets/i18n/', '.json');
}

// Debug: Verify interceptor is imported
console.log('🔧 Main.ts: Auth Interceptor imported:', typeof authInterceptor);
console.log('🔧 Main.ts: Auth Interceptor function:', authInterceptor);

function initSession(auth: AuthService) {
  return () => auth.verifySession();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: APP_INITIALIZER, useFactory: initSession, deps: [AuthService], multi: true },
    { provide: IMAGE_LOADER, useValue: imageLoader },
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      })
    ),
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
    }),
    // Configure ngx-translate (fallbackLang replaces deprecated defaultLanguage / useDefaultLang)
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'he',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    )
  ]
}).catch(err => console.error(err));
