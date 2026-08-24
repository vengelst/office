/**
 * Typen und Konstanten für den Kunden-Kontakte-Tab.
 */

import type { CustomerContact } from '@/lib/customers';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export const NONE = '__none__';
export const ALL = '__all__';
export const CONTACT_METHODS = ['EMAIL', 'PHONE', 'MOBILE'] as const;

/**
 * Externe Steuerung der Kontakte-Ansicht, z.B. beim Klick auf
 * "Kontakt bearbeiten" im Niederlassungs-Detail.
 */
export type ContactsExternalAction =
  | { kind: 'edit'; contact: CustomerContact }
  | { kind: 'create'; branchId: string | null }
  | { kind: 'scan' };

export type FormState = {
  title: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  branchId: string;
  email: string;
  phoneMobile: string;
  phoneLandline: string;
  birthday: string;
  linkedInUrl: string;
  preferredContactMethod: string;
  isAccountingContact: boolean;
  isProjectContact: boolean;
  isSignatory: boolean;
  syncToGoogle: boolean;
};

export const EMPTY: FormState = {
  title: '',
  firstName: '',
  lastName: '',
  role: '',
  department: '',
  branchId: NONE,
  email: '',
  phoneMobile: '',
  phoneLandline: '',
  birthday: '',
  linkedInUrl: '',
  preferredContactMethod: '',
  isAccountingContact: false,
  isProjectContact: false,
  isSignatory: false,
  syncToGoogle: true,
};
