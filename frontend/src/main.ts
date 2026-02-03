import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

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

bootstrapApplication(AppComponent, {
  providers: [
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
    // Configure ngx-translate
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'he',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    )
  ]
}).catch(err => console.error(err));
