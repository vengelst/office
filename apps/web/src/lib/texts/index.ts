/**
 * Aggregator aller UI-Text-Module (`texts`-Objekt).
 * Bestehende Imports `import { texts } from '@/lib/texts'` bleiben kompatibel.
 */

import { app } from './app';
import { nav } from './nav';
import { login } from './login';
import { header } from './header';
import { dashboard } from './dashboard';
import { customers } from './customers';
import { projects } from './projects';
import { workers } from './workers';
import { subcontractors } from './subcontractors';
import { teams } from './teams';
import { timesheets } from './timesheets';
import { customerPl } from './customerPl';
import { timeClock } from './timeClock';
import { invoices } from './invoices';
import { breakRules } from './breakRules';
import { workerApp } from './workerApp';
import { offlineClock } from './offlineClock';
import { settings } from './settings';
import { vehicles } from './vehicles';
import { documents } from './documents';
import { sitePhotos } from './sitePhotos';
import { kiosk } from './kiosk';
import { map } from './map';
import { equipment } from './equipment';
import { communication } from './communication';
import { todos } from './todos';
import { common } from './common';

export const texts = {
  app,
  nav,
  login,
  header,
  dashboard,
  customers,
  projects,
  workers,
  subcontractors,
  teams,
  timesheets,
  customerPl,
  timeClock,
  invoices,
  breakRules,
  workerApp,
  offlineClock,
  settings,
  vehicles,
  documents,
  sitePhotos,
  kiosk,
  map,
  equipment,
  communication,
  todos,
  common,
} as const;

export type Texts = typeof texts;
