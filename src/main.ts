import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((error: unknown) => {
  // If bootstrap itself fails the user would otherwise stare at a blank page.
  // The details go to the platform error reporter, never to the screen.
  reportError(error);
  const root = document.querySelector('app-root');
  if (root !== null) {
    root.textContent = 'Kibo Goods could not start. Please reload the page.';
  }
});
