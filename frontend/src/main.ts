import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

if (environment.production) {
  const noop = (): void => undefined;
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
