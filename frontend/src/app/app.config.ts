import { ApplicationConfig, APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideToastr } from 'ngx-toastr';
import { TranslateModule, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

const R2_PUBLIC_HOST = 'megadim-media.megadim.workers.dev';

/** In local Angular (localhost/127.0.0.1), serve R2 images via backend proxy to avoid browser/CDN flakes. */
function rewriteR2ForLocalDev(src: string): string {
  if (typeof window === 'undefined') return src;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (!isLocal) return src;
  const marker = `https://${R2_PUBLIC_HOST}/`;
  if (!src.startsWith(marker)) return src;
  const key = src.slice(marker.length);
  return `http://127.0.0.1:4000/api/media/${key}`;
}

/** Image loader: absolute/R2/local assets pass through. No Cloudinary transform fallback. */
function imageLoader(config: ImageLoaderConfig): string {
  const src = rewriteR2ForLocalDev(config.src);
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('assets')) {
    return src;
  }
  return '/assets/images/placeholder-dish.jpg';
}

export class CustomHttpLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private prefix: string = './assets/i18n/',
    private suffix: string = '.json'
  ) {}

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`${this.prefix}${lang}${this.suffix}`);
  }
}

export function HttpLoaderFactory(http: HttpClient): TranslateLoader {
  return new CustomHttpLoader(http, './assets/i18n/', '.json');
}

function initSession(auth: AuthService) {
  return () => auth.verifySession();
}

export const appConfig: ApplicationConfig = {
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
    provideHttpClient(withInterceptors([authInterceptor]), withFetch()),
    provideAnimations(),
    provideToastr({
      timeOut: 4000,
      positionClass: 'toast-top-left',
      preventDuplicates: true,
      closeButton: true,
      progressBar: true,
      enableHtml: true,
      tapToDismiss: true,
      maxOpened: 3,
      autoDismiss: true
    }),
    importProvidersFrom(
      MatSnackBarModule,
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
};
