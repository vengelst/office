/**
 * Service für Google Contacts.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable, Logger } from '@nestjs/common';
import { google, people_v1 } from 'googleapis';
import { AppSettingsService } from '../app-settings/app-settings.service';

export interface ContactData {
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phoneMobile?: string;
  phoneLandline?: string;
  role?: string;
  department?: string;
  company?: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  notes?: string;
}

export interface ContactsConfig {
  enabled: boolean;
  /** Service Account + Impersonation kommen aus den Drive-Einstellungen. */
  credentialsConfigured: boolean;
  impersonateEmail: string;
}

/**
 * Service für die Synchronisation von Ansprechpartnern mit Google Contacts.
 * Nutzt die People API mit Domain-Wide Delegation um Kontakte im Google-Konto
 * des impersonierten Benutzers (vivahome@vivahome.de) zu verwalten.
 */
@Injectable()
export class GoogleContactsService {
  private readonly logger = new Logger(GoogleContactsService.name);

  constructor(private readonly settings: AppSettingsService) {}

  /**
   * Liest Contacts-Toggle und ob Drive-Credentials vorhanden sind.
   */
  async getConfig(): Promise<ContactsConfig> {
    const [enabled, json, email] = await Promise.all([
      this.settings.get('google_contacts_enabled'),
      this.settings.get('google_drive_service_account_json'),
      this.settings.get('google_drive_impersonate_email'),
    ]);
    return {
      enabled: enabled === 'true',
      credentialsConfigured: Boolean(json?.trim() && email?.trim()),
      impersonateEmail: email ?? '',
    };
  }

  /**
   * Speichert nur den Contacts-Aktivierungsschalter.
   * Credentials bleiben unter Speicher & Cloud (Google Drive).
   */
  async saveConfig(config: Pick<ContactsConfig, 'enabled'>): Promise<void> {
    await this.settings.set('google_contacts_enabled', String(config.enabled));
  }

  /**
   * Prüft People-API-Zugang (contacts-Scope + DWD).
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const people = await this.authenticate({ requireEnabled: false });
      if (!people) {
        return {
          success: false,
          error:
            'Service Account oder Impersonation-E-Mail fehlt (unter Speicher & Cloud setzen).',
        };
      }
      await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1,
        personFields: 'names',
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Authentifiziert sich bei der Google People API via JWT und Domain-Wide Delegation.
   * Gibt null zurück wenn die Integration deaktiviert oder nicht konfiguriert ist.
   *
   * @returns Authentifizierte People-API-Instanz, oder null bei fehlender Konfiguration
   */
  private async authenticate(opts?: {
    requireEnabled?: boolean;
  }): Promise<people_v1.People | null> {
    const requireEnabled = opts?.requireEnabled !== false;
    const [enabled, json, email] = await Promise.all([
      this.settings.get('google_contacts_enabled'),
      this.settings.get('google_drive_service_account_json'),
      this.settings.get('google_drive_impersonate_email'),
    ]);

    if (requireEnabled && enabled !== 'true') return null;
    if (!json?.trim() || !email?.trim()) return null;

    const credentials = JSON.parse(json);
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/contacts'],
      subject: email,
    });

    return google.people({ version: 'v1', auth: jwtClient });
  }

  /**
   * Erstellt einen neuen Kontakt in Google Contacts.
   * Gibt die resourceName-Referenz zurück, die in der DB gespeichert wird.
   *
   * @param data - Kontaktdaten (Name, E-Mail, Telefon, Adresse, etc.)
   * @returns Google resourceName (z.B. "people/c1234567890"), oder null bei Fehler
   */
  async createContact(data: ContactData): Promise<string | null> {
    const people = await this.authenticate();
    if (!people) {
      this.logger.debug('Google Contacts Sync deaktiviert – überspringe.');
      return null;
    }

    try {
      const person = this.buildPerson(data);
      const res = await people.people.createContact({
        requestBody: person,
        personFields: 'names',
      });
      const resourceName = res.data.resourceName ?? null;
      this.logger.log(`Google Kontakt erstellt: ${resourceName}`);
      return resourceName;
    } catch (err) {
      this.logger.warn(
        `Google Kontakt konnte nicht erstellt werden: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Aktualisiert einen bestehenden Google-Kontakt.
   * Liest zuerst den aktuellen ETag für Conflict-Resolution und schreibt dann die neuen Daten.
   *
   * @param resourceName - Google resourceName des Kontakts
   * @param data - Aktualisierte Kontaktdaten
   * @returns true bei Erfolg, false bei Fehler
   */
  async updateContact(
    resourceName: string,
    data: ContactData,
  ): Promise<boolean> {
    const people = await this.authenticate();
    if (!people) return false;

    try {
      const existing = await people.people.get({
        resourceName,
        personFields: 'names,metadata',
      });
      const etag = existing.data.etag;

      const person = this.buildPerson(data);
      person.etag = etag ?? undefined;

      await people.people.updateContact({
        resourceName,
        updatePersonFields:
          'names,emailAddresses,phoneNumbers,organizations,addresses,biographies',
        requestBody: person,
      });

      this.logger.log(`Google Kontakt aktualisiert: ${resourceName}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Google Kontakt konnte nicht aktualisiert werden: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Löscht einen Kontakt aus Google Contacts.
   *
   * @param resourceName - Google resourceName des zu löschenden Kontakts
   * @returns true bei Erfolg, false bei Fehler
   */
  async deleteContact(resourceName: string): Promise<boolean> {
    const people = await this.authenticate();
    if (!people) return false;

    try {
      await people.people.deleteContact({ resourceName });
      this.logger.log(`Google Kontakt gelöscht: ${resourceName}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Google Kontakt konnte nicht gelöscht werden: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Baut ein People-API-konformes Person-Objekt aus den internen Kontaktdaten.
   * Mapped unsere flachen Felder auf die verschachtelte Google-Struktur
   * (names, emailAddresses, phoneNumbers, organizations, addresses, biographies).
   *
   * @param data - Interne Kontaktdaten
   * @returns Google People API Schema$Person Objekt
   */
  private buildPerson(data: ContactData): people_v1.Schema$Person {
    const person: people_v1.Schema$Person = {
      names: [
        {
          givenName: data.firstName,
          familyName: data.lastName,
          honorificPrefix: data.title || undefined,
        },
      ],
    };

    if (data.email) {
      person.emailAddresses = [{ value: data.email, type: 'work' }];
    }

    const phones: people_v1.Schema$PhoneNumber[] = [];
    if (data.phoneMobile) phones.push({ value: data.phoneMobile, type: 'mobile' });
    if (data.phoneLandline) phones.push({ value: data.phoneLandline, type: 'work' });
    if (phones.length) person.phoneNumbers = phones;

    if (data.company || data.role || data.department) {
      person.organizations = [
        {
          name: data.company || undefined,
          title: data.role || undefined,
          department: data.department || undefined,
          type: 'work',
        },
      ];
    }

    if (data.addressLine1 || data.city) {
      person.addresses = [
        {
          streetAddress: data.addressLine1 || undefined,
          postalCode: data.postalCode || undefined,
          city: data.city || undefined,
          country: data.country || undefined,
          type: 'work',
        },
      ];
    }

    if (data.notes) {
      person.biographies = [{ value: data.notes, contentType: 'TEXT_PLAIN' }];
    }

    return person;
  }
}
