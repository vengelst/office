/** Einzelnes erkanntes Feld einer Visitenkarte mit Konfidenzwert (0-1). */
export interface BusinessCardField<T = string> {
  value: T | null;
  confidence: number;
}

/** Vollständig geparste Visitenkarten-Daten mit allen erkannten Feldern und deren Konfidenz. */
export interface BusinessCardData {
  firstName: BusinessCardField;
  lastName: BusinessCardField;
  title: BusinessCardField;
  role: BusinessCardField;
  department: BusinessCardField;
  company: BusinessCardField;
  email: BusinessCardField;
  phoneMobile: BusinessCardField;
  phoneLandline: BusinessCardField;
  addressLine1: BusinessCardField;
  postalCode: BusinessCardField;
  city: BusinessCardField;
  country: BusinessCardField;
  website: BusinessCardField;
  linkedInUrl: BusinessCardField;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
const PHONE_RE =
  /(?:\+?\d{1,4}[\s/.-]?)?(?:\(?\d{2,5}\)?[\s/.-]?)?\d[\d\s/.-]{4,}\d/g;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.[\w]{2,}(?:\/[\w./-]*)?/gi;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/gi;
const PLZ_CITY_RE = /\b(\d{4,5})\s+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\s-]+)/;
const STREET_RE =
  /([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß.\s-]+(?:str\.|straße|weg|gasse|allee|platz|ring|damm))\s*\d+[\s\w]*/i;

const MOBILE_HINTS = ['mobil', 'mobile', 'handy', 'cell', '+49 1', '+491', '01'];
const LANDLINE_HINTS = ['tel', 'phone', 'fon', 'fax', 'festnetz'];
const TITLE_PREFIXES = ['herr', 'frau', 'mr', 'mrs', 'ms', 'dr', 'prof'];

/**
 * Hilfsfunktion: Erzeugt ein BusinessCardField mit Wert und Konfidenz.
 */
function field<T = string>(
  value: T | null,
  confidence: number,
): BusinessCardField<T> {
  return { value, confidence };
}

/**
 * Parst den OCR-Text einer Visitenkarte und extrahiert strukturierte Kontaktdaten.
 * Erkennt mittels Regex-Heuristiken: Name, Titel, Firma, E-Mail, Telefonnummern,
 * Adresse, Website und LinkedIn-URL. Jedes Feld erhält einen Konfidenzwert.
 *
 * @param ocrText - Roher OCR-Text (mehrzeilig, wie vom OCR-Service geliefert)
 * @returns Strukturierte Visitenkarten-Daten mit Konfidenzwerten pro Feld
 */
export function parseBusinessCard(ocrText: string): BusinessCardData {
  const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  const emails: string[] = fullText.match(EMAIL_RE) ?? [];
  const linkedIns: string[] = fullText.match(LINKEDIN_RE) ?? [];
  const urls = (fullText.match(URL_RE) ?? [] as string[]).filter(
    (u) => !emails.includes(u) && !linkedIns.some((li) => u.includes(li)),
  );

  const phones = extractPhones(fullText, lines);
  const address = extractAddress(fullText);
  const name = extractName(lines, emails);

  return {
    firstName: field(name.firstName, name.firstName ? 0.7 : 0),
    lastName: field(name.lastName, name.lastName ? 0.7 : 0),
    title: field(name.title, name.title ? 0.8 : 0),
    role: field(name.role, name.role ? 0.5 : 0),
    department: field<string>(null, 0),
    company: field(name.company, name.company ? 0.6 : 0),
    email: field(emails[0] ?? null, emails.length > 0 ? 0.95 : 0),
    phoneMobile: field(phones.mobile, phones.mobile ? 0.8 : 0),
    phoneLandline: field(phones.landline, phones.landline ? 0.8 : 0),
    addressLine1: field(address.street, address.street ? 0.7 : 0),
    postalCode: field(address.postalCode, address.postalCode ? 0.9 : 0),
    city: field(address.city, address.city ? 0.85 : 0),
    country: field(address.country, address.country ? 0.6 : 0),
    website: field(urls[0] ?? null, urls.length > 0 ? 0.9 : 0),
    linkedInUrl: field(linkedIns[0] ?? null, linkedIns.length > 0 ? 0.95 : 0),
  };
}

/**
 * Extrahiert Mobil- und Festnetznummern aus dem Visitenkartentext.
 * Unterscheidet anhand von Hinweiswörtern (mobil, tel, fon) und Nummernpräfixen (01x, +49 1x).
 *
 * @param fullText - Gesamter OCR-Text
 * @param lines - Einzelne Textzeilen
 * @returns Objekt mit erkannter Mobil- und Festnetznummer (oder null)
 */
function extractPhones(
  fullText: string,
  lines: string[],
): { mobile: string | null; landline: string | null } {
  let mobile: string | null = null;
  let landline: string | null = null;

  for (const line of lines) {
    const found = line.match(PHONE_RE);
    if (!found) continue;
    const lower = line.toLowerCase();
    for (const phone of found) {
      const cleaned = phone.replace(/[\s/.-]/g, '');
      if (cleaned.length < 6) continue;

      const isMobile =
        MOBILE_HINTS.some((h) => lower.includes(h)) ||
        /^\+?\d{0,2}1[567]/.test(cleaned) ||
        /^01[567]/.test(cleaned);
      const isLandline = LANDLINE_HINTS.some((h) => lower.includes(h));

      if (isMobile && !mobile) {
        mobile = phone.trim();
      } else if ((isLandline || !mobile) && !landline) {
        landline = phone.trim();
      } else if (!mobile && !isMobile) {
        mobile = phone.trim();
      }
    }
  }

  if (mobile && !landline) {
    const allPhones = fullText.match(PHONE_RE) ?? [];
    const other = allPhones.find((p) => p.trim() !== mobile);
    if (other) landline = other.trim();
  }

  return { mobile, landline };
}

/**
 * Extrahiert Adressdaten (Straße, PLZ, Stadt, Land) aus dem OCR-Text.
 * Erkennt deutsche Adressformate (Straßenname + Hausnummer, 5-stellige PLZ + Stadt).
 *
 * @param fullText - Gesamter OCR-Text
 * @returns Objekt mit erkannten Adressbestandteilen (oder null pro Feld)
 */
function extractAddress(fullText: string): {
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
} {
  const streetMatch = fullText.match(STREET_RE);
  const plzMatch = fullText.match(PLZ_CITY_RE);

  const countries = ['deutschland', 'germany', 'österreich', 'austria', 'schweiz', 'switzerland'];
  const countryLine = fullText
    .split('\n')
    .find((l) => countries.some((c) => l.toLowerCase().includes(c)));

  return {
    street: streetMatch?.[0]?.trim() ?? null,
    postalCode: plzMatch?.[1] ?? null,
    city: plzMatch?.[2]?.trim() ?? null,
    country: countryLine?.trim() ?? null,
  };
}

/**
 * Extrahiert Personennamen, Titel, Rolle und Firma aus den ersten Zeilen der Visitenkarte.
 * Nutzt Heuristiken: Titelkürzel (Dr., Prof.), Namensstruktur, E-Mail-Benutzerteil
 * zur Validierung, und Positionslogik (Name steht meist oben, Rolle darunter).
 *
 * @param lines - Bereinigte Textzeilen der Visitenkarte
 * @param emails - Bereits erkannte E-Mail-Adressen (für Namensvalidierung)
 * @returns Objekt mit Vorname, Nachname, Titel, Rolle und Firma (oder null)
 */
function extractName(
  lines: string[],
  emails: string[],
): {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  role: string | null;
  company: string | null;
} {
  let title: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let role: string | null = null;
  let company: string | null = null;

  const emailUser = emails[0]?.split('@')[0] ?? '';
  const emailParts = emailUser.split(/[._-]/).map((p) => p.toLowerCase());

  for (const line of lines.slice(0, 6)) {
    if (EMAIL_RE.test(line)) continue;
    if (PHONE_RE.test(line)) continue;
    if (URL_RE.test(line)) continue;
    if (PLZ_CITY_RE.test(line)) continue;
    if (STREET_RE.test(line)) continue;

    const words = line.split(/\s+/);
    const lower = line.toLowerCase();

    if (
      TITLE_PREFIXES.some((t) => lower.startsWith(t)) ||
      (words.length >= 2 &&
        words.length <= 4 &&
        words.every((w) => /^[A-ZÄÖÜa-zäöüß][a-zäöüß.-]*$/.test(w)) &&
        !firstName)
    ) {
      const nameParts = [...words];
      if (TITLE_PREFIXES.some((t) => nameParts[0].toLowerCase().startsWith(t))) {
        title = nameParts.shift()!.replace(/\.$/, '');
      }
      if (nameParts.length >= 2) {
        firstName = nameParts.slice(0, -1).join(' ');
        lastName = nameParts[nameParts.length - 1];
      } else if (nameParts.length === 1) {
        lastName = nameParts[0];
      }

      if (emailParts.length >= 2 && firstName) {
        const firstLower = firstName.toLowerCase();
        const lastLower = (lastName ?? '').toLowerCase();
        if (
          emailParts.includes(firstLower) ||
          emailParts.includes(lastLower) ||
          emailParts[0] === firstLower[0]
        ) {
          firstName = firstName;
        }
      }
      continue;
    }

    if (!role && firstName && words.length <= 6 && !PHONE_RE.test(line)) {
      role = line;
      continue;
    }

    if (!company && firstName && !role) {
      company = line;
    } else if (!company && role) {
      company = line;
    }
  }

  if (!company) {
    const emailDomain = emails[0]?.split('@')[1]?.split('.')[0] ?? null;
    if (emailDomain && emailDomain.length > 2) {
      const companyLine = lines.find(
        (l) =>
          l.toLowerCase().includes(emailDomain.toLowerCase()) &&
          !EMAIL_RE.test(l) &&
          !URL_RE.test(l),
      );
      if (companyLine) company = companyLine;
    }
  }

  return { firstName, lastName, title, role, company };
}
