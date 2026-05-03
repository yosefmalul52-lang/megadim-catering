import { ApplicationConfig, APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { TranslateModule, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

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
