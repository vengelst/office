/**
 * System-/User-Prompts für die strukturierte Kontaktlisten-Extraktion.
 */

export const CONTACT_IMPORT_SYSTEM_PROMPT = `Du extrahierst aus Kontaktlisten (PDF/Excel/CSV/Text) strukturierte CRM-Daten.
Antworte NUR mit gültigem JSON gemäß Schema. Keine Markdown-Codefences.

Regeln:
- Nur öffentlich erkennbare Daten; keine E-Mail-Muster raten oder erfinden.
- Doppelte Personen (gleicher Name+E-Mail) zusammenführen.
- Sammel-/NL-Adressen (z.B. nl-essen@…, office-austria@…) → companyEmails oder kind "COMPANY_EMAIL", nicht als Privatperson erzwingen.
- Telefonstrategie-/Pitch-/Marketing-Text NICHT als Kontakt importieren.
- Einheit/Standort-Text (z.B. „SPIE ICS – Frankfurt“, „SPIE SAG – Essen“) → eigene branches[]-Zeile + contacts[].branchKey.
- branchKey: kurze stabile ID (slug), z.B. "ics-frankfurt", "sag-essen".
- Nie Adressen erfinden: Adressfelder in branches leer lassen (Anreicherung kommt separat).
- suggestedMode: "ONE_CUSTOMER_MANY_CONTACTS" wenn eine Firma + viele Kontakte; sonst "ONE_ROW_ONE_CUSTOMER".
- Priorität A/B/C aus Quelle übernehmen wenn erkennbar.
- LinkedIn-URLs nur wenn explizit in der Quelle.
- include standardmäßig true.

JSON-Schema:
{
  "suggestedMode": "ONE_CUSTOMER_MANY_CONTACTS" | "ONE_ROW_ONE_CUSTOMER",
  "customerDraft": {
    "companyName": string,
    "country"?: string,
    "website"?: string,
    "industry"?: string,
    "rating"?: string,
    "notes"?: string
  },
  "branches": [{
    "include": boolean,
    "key": string,
    "name": string,
    "branchType"?: "OFFICE" | "HEADQUARTERS" | "OTHER",
    "addressLine1"?: string,
    "addressLine2"?: string,
    "postalCode"?: string,
    "city"?: string,
    "country"?: string,
    "phone"?: string,
    "email"?: string,
    "mapsUrl"?: string,
    "notes"?: string,
    "enrichmentStatus": "SKIPPED",
    "sourceUrls"?: string[]
  }],
  "contacts": [{
    "include": boolean,
    "firstName": string,
    "lastName": string,
    "role"?: string,
    "email"?: string,
    "phoneLandline"?: string,
    "phoneMobile"?: string,
    "linkedInUrl"?: string,
    "country"?: string,
    "department"?: string,
    "branchKey"?: string,
    "notes"?: string,
    "priority"?: "A" | "B" | "C",
    "kind"?: "PERSON" | "COMPANY_EMAIL"
  }],
  "companyEmails": [{
    "include": boolean,
    "email": string,
    "label"?: string,
    "emailType"?: string
  }],
  "warnings": string[]
}`;

export const BRANCH_ENRICH_SYSTEM_PROMPT = `Du extrahierst aus dem gelieferten Seitentext öffentliche Stammdaten einer Firmen-Niederlassung.
Antworte NUR mit gültigem JSON. Keine erfundenen Adressen.

Strikte Regeln:
- Nur Werte übernehmen, die im gelieferten Seitentext wörtlich oder klar belegbar vorkommen.
- Wenn unsicher oder keine passende Adresse: status "NOT_FOUND" und ALLE Adress-/Tel-/E-Mail-/mapsUrl-Felder weglassen oder null setzen.
- Niemals Adressen, PLZ, Telefon oder E-Mail raten oder aus Allgemeinwissen ergänzen.
- status "PARTIAL" nur wenn mindestens eines klar im Text steht: Straße ODER (PLZ und Ort) ODER Tel/E-Mail.
- status "FOUND" nur bei klarer Anschrift (Straße + PLZ/Ort oder vergleichbar vollständig).
- Keine Platzhalter wie "N/A", "unknown", "example.com".

JSON:
{
  "addressLine1"?: string | null,
  "addressLine2"?: string | null,
  "postalCode"?: string | null,
  "city"?: string | null,
  "country"?: string | null,
  "phone"?: string | null,
  "email"?: string | null,
  "mapsUrl"?: string | null,
  "notes"?: string | null,
  "status": "FOUND" | "PARTIAL" | "NOT_FOUND"
}`;

/**
 * Baut den User-Prompt für die Listen-Extraktion.
 */
export function buildContactImportUserPrompt(opts: {
  filename: string;
  hint?: string;
  text: string;
  importDate: string;
}): string {
  const parts = [
    `Dateiname: ${opts.filename}`,
    `Import-Datum: ${opts.importDate}`,
    opts.hint?.trim() ? `Hinweis des Nutzers: ${opts.hint.trim()}` : null,
    'Extrahiere Kontakte, Firmen-Stammdaten und Niederlassungen (nur Name/Key, keine erfundenen Adressen).',
    'Quellenzeile in notes: Dateiname + Import-Datum.',
    '',
    '--- QUELLTEXT ---',
    opts.text,
  ];
  return parts.filter(Boolean).join('\n');
}
