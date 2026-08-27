/**
 * One-shot: SPIE Outreach-Liste → 1 Customer + Kontakte (+ Firmen-E-Mails).
 * syncToGoogle = false (kein Massen-Sync nach Google Contacts).
 * Idempotent: bricht ab, wenn bereits ein Kunde "SPIE" mit Marker in notes existiert.
 *
 * Usage (im API-Container):
 *   node /tmp/import-spie-outreach.mjs
 */
const { PrismaClient } = require('@prisma/client');

const SOURCE_MARKER = 'Quelle: SPIE_Kontaktliste_und_Outreach.pdf (Stand 24.03.2026)';

const prisma = new PrismaClient();

function splitName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function notes({ prio, unit, country, extra }) {
  return [
    SOURCE_MARKER,
    `Priorität: ${prio}`,
    unit ? `SPIE-Einheit: ${unit}` : null,
    country ? `Land: ${country}` : null,
    extra || null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** @type {{ name: string, role: string, unit: string, country: string, email: string, phone: string, prio: string, extra?: string }[]} */
const officialPersons = [
  { name: 'Sascha Schulmayer', role: 'Physical Security', unit: 'SPIE ICS – Frankfurt', country: 'DE', email: 'sascha.schulmayer@spie.com', phone: '+49 6105 2792701', prio: 'A' },
  { name: 'Patrick Meier', role: 'Physical Security', unit: 'SPIE ICS – Karlsruhe', country: 'DE', email: 'patrick.meier@spie.de', phone: '+49 721 9632 187', prio: 'A' },
  { name: 'Holger Kramer', role: 'Physical Security + Datacenter', unit: 'SPIE ICS – Bremen', country: 'DE', email: 'holger.kramer@spie.com', phone: '+49 421 57652521', prio: 'A' },
  { name: 'André Süß', role: 'Physical Security', unit: 'SPIE ICS – Berlin', country: 'DE', email: 'andre.suess@spie.de', phone: '+49 30 666999-117', prio: 'A' },
  { name: 'Andreas Brosch', role: 'Physical Security', unit: 'SPIE ICS – Essen / Aachen', country: 'DE', email: 'andreas.brosch@spie.com', phone: '+49 211 90096120', prio: 'A', extra: 'In Quelldatei 2× (Essen + Aachen) → zusammengeführt' },
  { name: 'Andreas Gebauer', role: 'Physical Security + Fire & Safety', unit: 'SPIE ICS – Kassel', country: 'DE', email: 'andreas.gebauer2@spie.com', phone: '+49 561 76658-25', prio: 'A' },
  { name: 'Thomas Hoffmann', role: 'Physical Security + Fire & Safety', unit: 'SPIE ICS – Magdeburg', country: 'DE', email: 'thomas.hoffmann@spie.com', phone: '+49 391 256470', prio: 'A' },
  { name: 'André Wünsch', role: 'Physical Security + Fire & Safety', unit: 'SPIE ICS – Dresden', country: 'DE', email: 'andre.wuensch@spie.com', phone: '+49 0351 4720804', prio: 'A' },
  { name: 'Tim Gröblinghoff', role: 'Physical Security', unit: 'SPIE GfT GmbH – Essen', country: 'DE', email: 'tim.groeblinghoff@spie.com', phone: '+49 201 80668325', prio: 'A' },
  { name: 'Stjepan Toma', role: 'Physical Security + Fire & Safety', unit: 'SPIE ICS – Stuttgart', country: 'DE', email: 'stjepan.toma@spie.com', phone: '+49 711 48909246', prio: 'A' },
  { name: 'Gundolf Anders', role: 'Physical Security', unit: 'SPIE ICS – Leipzig', country: 'DE', email: 'g.anders@spie.com', phone: '+49 341 2453813', prio: 'A' },
  { name: 'Michael Lewrenz', role: 'Physical Security', unit: 'SPIE ICS – Erfurt', country: 'DE', email: 'michael.lewrenz@spie.com', phone: '+49 361 42086 23', prio: 'A' },
  { name: 'Tobias Hambsch', role: 'Physical Security', unit: 'SPIE ICS – Löbichau', country: 'DE', email: 'tobias.hambsch@spie.com', phone: '+49 151 54415404', prio: 'A' },
  { name: 'Erwin Engelschalk', role: 'Physical Security', unit: 'SPIE ICS – Wörthsee', country: 'DE', email: 'erwin.engelschalk@spie.com', phone: '+49 8153 997711', prio: 'A' },
  { name: 'Dirk Jürgens', role: 'Fire & Safety', unit: 'SPIE ICS – Wolfsburg', country: 'DE', email: 'dirk.juergens@spie.com', phone: '+49 5361 500932', prio: 'A' },
  { name: 'Timo Vogtmann', role: 'Gebäudebeleuchtung', unit: 'SPIE Efficient Facilities – Frankfurt am Main', country: 'DE', email: 'timo.vogtmann@spie.com', phone: '+49 69 66496701', prio: 'B' },
  { name: 'Frank Piroth', role: 'Gebäudebeleuchtung', unit: 'SPIE Efficient Facilities – Frankfurt Süd-Main', country: 'DE', email: 'frank.piroth@spie.com', phone: '+49 69 66491965', prio: 'B' },
  { name: 'Udo Oerther', role: 'Kabelbau NS/MS', unit: 'SPIE SAG – Nordbayern', country: 'DE', email: 'nl-nordbayern@spie.com', phone: '+49 911 833010', prio: 'B', extra: 'E-Mail = Sammeladresse NL' },
  { name: 'Sascha Arnold', role: 'Kabelbau, Kommunikationsnetze', unit: 'SPIE SAG – Ostbayern', country: 'DE', email: 'sascha.arnold@spie.com', phone: '+49 871704352', prio: 'B' },
  { name: 'Nina Fitz', role: 'Kabelbau & Breitbandausbau', unit: 'SPIE SAG – Gelsenkirchen', country: 'DE', email: 'nl-essen@spie.com', phone: '+49 209 60571836', prio: 'B', extra: 'E-Mail = Sammeladresse NL Essen' },
  { name: 'Frank Sigloch', role: 'Physical Security', unit: 'SPIE SAG – Riederich', country: 'DE', email: 'nl.stuttgart@spie.com', phone: '+49 7144 837222', prio: 'B', extra: 'E-Mail = Sammeladresse NL Stuttgart' },
];

/** @type {{ label: string, email: string, phone: string, country: string, unit: string, prio: string }[]} */
const companyEmails = [
  { label: 'SPIE Austria Zentrale', email: 'office-austria@spie.com', phone: '+43 316 425 043', country: 'AT', unit: 'SPIE Austria GmbH – Graz', prio: 'B' },
  { label: 'SPIE Schweiz General', email: 'info.ch@spie.com', phone: '+41 58 301 11 11', country: 'CH', unit: 'SPIE Switzerland AG – Wallisellen', prio: 'B' },
  { label: 'SPIE ICS Schweiz Support', email: 'customer.care.ch@spie.com', phone: '0848 888 644', country: 'CH', unit: 'SPIE ICS AG – Schweiz', prio: 'B' },
  { label: 'SPIE MTS Schweiz', email: 'info.spiemts@spie.com', phone: '+41 58 301 18 18', country: 'CH', unit: 'SPIE MTS AG – Schweiz romande', prio: 'B' },
];

/** @type {{ name: string, role: string, unit: string, country: string, linkedIn: string, prio: string }[]} */
const linkedInLeads = [
  { name: 'Tobias Kempkens', role: 'Projektleiter', unit: 'SPIE Energy Solutions GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/tobias-kempkens-032b4a255', prio: 'C' },
  { name: 'Michael Weigelt', role: 'Projektleiter', unit: 'Spie GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/michael-weigelt-471173125', prio: 'C' },
  { name: 'Kai Ahrens', role: 'Project Manager', unit: 'SPIE SAG GmbH Grid Solutions', country: 'DE', linkedIn: 'https://de.linkedin.com/in/kai-ahrens', prio: 'B' },
  { name: 'Christoph Bausch', role: 'Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/christoph-bausch-6a5113256', prio: 'B' },
  { name: 'Christoph Weiß', role: 'Projektleitung', unit: 'SPIE SAG', country: 'DE', linkedIn: 'https://de.linkedin.com/in/christoph-wei%C3%9F-738590169', prio: 'B' },
  { name: 'Peter Merk', role: 'Projektleiter', unit: 'SPIE Deutschland & Zentraleuropa', country: 'DE', linkedIn: 'https://de.linkedin.com/in/peter-merk-436445162', prio: 'C' },
  { name: 'Tim B.', role: 'Projektleiter', unit: 'SPIE Deutschland & Zentraleuropa', country: 'DE', linkedIn: 'https://de.linkedin.com/in/tim-b-814196248', prio: 'C' },
  { name: 'Johannes Müller', role: 'Senior Project Manager / kaufmännischer Projektleiter', unit: 'SPIE Deutschland & Zentraleuropa', country: 'DE', linkedIn: 'https://de.linkedin.com/in/johannes-m%C3%BCller-7071b017b', prio: 'C' },
  { name: 'Stefan Pawendenat', role: 'Projektleiter', unit: 'SPIE Buchmann', country: 'DE', linkedIn: 'https://de.linkedin.com/in/stefan-pawendenat-b1a488345', prio: 'C' },
  { name: 'Michael Kolkenbrock', role: 'Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/michael-kolkenbrock-422571131', prio: 'B' },
  { name: 'Julian Schmidtmann', role: 'Projektleiter', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/julian-schmidtmann-7187182bb', prio: 'A' },
  { name: 'Felix Gelz', role: 'Projektleiter und stellv. Standortleiter', unit: 'SPIE Buchmann GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/felix-gelz-81128212b', prio: 'C' },
  { name: 'Sebastian Kulla', role: 'Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/sebastian-kulla-35204b18b', prio: 'B' },
  { name: 'Dag Klein', role: 'Projektleiter', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/dag-klein-a7486a151', prio: 'A' },
  { name: 'Carsten Greif', role: 'Projektleiter', unit: 'SPIE Buchmann GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/carsten-greif-b819272b0', prio: 'C' },
  { name: 'Torsten Mai', role: 'Projektleiter', unit: 'SPIE ICS GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/torsten-mai-89243992', prio: 'A' },
  { name: 'Alexander Mauersberger', role: 'Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/alexander-mauersberger-404213174', prio: 'B' },
  { name: 'Justin Ivanciuc', role: 'Projektleiter für Gebäudetechnik', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/justin-ivanciuc-893807206', prio: 'A' },
  { name: 'César Hügle', role: 'Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/c%C3%A9sar-h%C3%BCgle-828640b3', prio: 'B' },
  { name: 'Dominik Raak', role: 'Project Manager UCC', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/dominik-raak-b53682216', prio: 'A' },
  { name: 'Robin Hoffmann', role: 'Projektleiter Lighting & Smart City Solutions', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/robin-hoffmann-007a13322', prio: 'B' },
  { name: 'Niels Schwertmann', role: 'Bau- und Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/niels-schwertmann-28646a3a5', prio: 'B' },
  { name: 'Karsten Börner', role: 'Projektleiter', unit: 'SPIE SAG GmbH', country: 'DE', linkedIn: 'https://de.linkedin.com/in/karsten-b%C3%B6rner-643801171', prio: 'B' },
  { name: 'Mieczyslaw Blanek', role: 'Projektleiter', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/mieczyslaw-blanek-748449290', prio: 'A' },
  { name: 'Jochen Hepp', role: 'Projektleiter Sicherheitstechnik', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/jochen-hepp-4729501a6', prio: 'A' },
  { name: 'Yannik Rennar', role: 'Projektmanager', unit: 'SPIE Germany Switzerland Austria', country: 'DE', linkedIn: 'https://de.linkedin.com/in/yannik-rennar', prio: 'C' },
  { name: 'Michael Filippi jr.', role: 'Projektleiter', unit: 'SPIE BTAT', country: 'DE', linkedIn: 'https://de.linkedin.com/in/michael-filippi-jr-b91741231', prio: 'A' },
  { name: 'Peter Schurr', role: 'Abteilungsleitung Projekte Tunnel und Verkehr', unit: 'SPIE BTAT', country: 'DE', linkedIn: 'https://de.linkedin.com/in/peter-schurr-083548127', prio: 'A' },
  { name: 'Thomas Heier', role: 'SPIE ICS (öffentlicher Profilhinweis)', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/thomas-heier-495b85236', prio: 'A' },
  { name: 'Christian Dove', role: 'Projektleiter', unit: 'SPIE ICS', country: 'DE', linkedIn: 'https://de.linkedin.com/in/christian-dove-95344b8a', prio: 'A' },
  { name: 'Thomas Schaller', role: 'IT-Projektleiter', unit: 'SPIE Austria GmbH', country: 'AT', linkedIn: 'https://at.linkedin.com/in/thomas-schaller-a0200317a', prio: 'C' },
  { name: 'Lukas Niederstrasser', role: 'Teamleiter/Projektleiter', unit: 'SPIE KEM GmbH – Infrastruktur', country: 'AT', linkedIn: 'https://at.linkedin.com/in/lukas-niederstrasser-50a0a1224', prio: 'B' },
  { name: 'Walter Weinfurter', role: 'Technischer Projektleiter', unit: 'SPIE Dürr-Austria GmbH', country: 'AT', linkedIn: 'https://at.linkedin.com/in/walter-weinfurter-1b6b6296', prio: 'C' },
  { name: 'Ervin Cehajic', role: 'Projektleiter', unit: 'SPIE CEMA GmbH', country: 'AT', linkedIn: 'https://at.linkedin.com/in/ervin-cehajic-2700651b7', prio: 'C' },
  { name: 'Thomas Szakacs', role: 'Projektleiter elektrische Tunnelausstattung', unit: 'SPIE Dürr', country: 'AT', linkedIn: 'https://at.linkedin.com/in/thomas-szakacs-872684230', prio: 'B' },
  { name: 'Wolfgang Biegler', role: 'Projectmanager', unit: 'SPIE CEMA GmbH', country: 'AT', linkedIn: 'https://at.linkedin.com/in/wolfgang-biegler-864376182', prio: 'C' },
  { name: 'Christian Dampfhofer', role: 'Projektmanager', unit: 'SPIE Dürr', country: 'AT', linkedIn: 'https://at.linkedin.com/in/christian-dampfhofer-334b69245', prio: 'C' },
  { name: 'Matthäus Reisenbichler', role: 'früher Projektleiter', unit: 'SPIE CEMA', country: 'AT', linkedIn: 'https://at.linkedin.com/in/matth%C3%A4us-reisenbichler-796763362', prio: 'C' },
  { name: 'David Dober', role: 'Project Manager', unit: 'SPIE ICS AG', country: 'CH', linkedIn: 'https://ch.linkedin.com/in/david-dober-7b90626', prio: 'A' },
  { name: 'Fabian Schmid', role: 'Project & Service Account Manager', unit: 'SPIE Switzerland', country: 'CH', linkedIn: 'https://ch.linkedin.com/in/fabian-schmid-667476127', prio: 'C' },
  { name: 'Jörgen Hinni', role: 'Leiter IT / IT-Projektleiter', unit: 'SPIE ICS', country: 'CH', linkedIn: 'https://ch.linkedin.com/in/j%C3%B6rgen-hinni', prio: 'A' },
  { name: 'Gabriel Lukas Frey', role: 'Commercial Project Manager', unit: 'SPIE Schweiz AG', country: 'CH', linkedIn: 'https://ch.linkedin.com/in/gabriel-lukas-frey-23ab7a99', prio: 'C' },
  { name: 'Benu Zaugg', role: 'Project / Service Manager', unit: 'SPIE ICS AG', country: 'CH', linkedIn: 'https://ch.linkedin.com/in/benu-zaugg-28042175', prio: 'A' },
  { name: 'Volker Bruno Schulz', role: 'früher Mandats- und Projektleiter', unit: 'SPIE ICS / IFS', country: 'CH', linkedIn: 'https://ch.linkedin.com/in/volker-bruno-schulz-a57801246', prio: 'A' },
];

async function nextCustomerNumber() {
  const year = new Date().getFullYear();
  const prefix = `K-${year}-`;
  const last = await prisma.customer.findFirst({
    where: { customerNumber: { startsWith: prefix } },
    orderBy: { customerNumber: 'desc' },
    select: { customerNumber: true },
  });
  const lastSeq = last
    ? Number.parseInt(last.customerNumber.slice(prefix.length), 10) || 0
    : 0;
  return `${prefix}${(lastSeq + 1).toString().padStart(4, '0')}`;
}

async function main() {
  const existing = await prisma.customer.findFirst({
    where: {
      companyName: { equals: 'SPIE', mode: 'insensitive' },
      notes: { contains: SOURCE_MARKER },
      deletedAt: null,
    },
  });
  if (existing) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: 'SPIE mit diesem Quellen-Marker existiert bereits',
        customerId: existing.id,
        customerNumber: existing.customerNumber,
      }),
    );
    return;
  }

  const customerNumber = await nextCustomerNumber();

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        customerNumber,
        companyName: 'SPIE',
        status: 'ACTIVE',
        industry: 'Technik / Facility / Security',
        country: 'DE',
        website: 'https://www.spie.de',
        rating: 'A',
        notes: [
          'Interessent / Potential (Outreach)',
          SOURCE_MARKER,
          '44 LinkedIn-Leads + 26 offizielle öffentliche Kontakte.',
          'Google-Sync für importierte Kontakte deaktiviert.',
        ].join('\n'),
      },
    });

    let contactCount = 0;

    for (const row of officialPersons) {
      const { firstName, lastName } = splitName(row.name);
      const isMobile = row.phone.includes('151 ');
      await tx.customerContact.create({
        data: {
          customerId: customer.id,
          firstName,
          lastName,
          role: row.role,
          email: row.email,
          phoneMobile: isMobile ? row.phone : null,
          phoneLandline: isMobile ? null : row.phone,
          country: row.country,
          notes: notes({
            prio: row.prio,
            unit: row.unit,
            country: row.country,
            extra: row.extra,
          }),
          isProjectContact: true,
          preferredContactMethod: 'PHONE',
          syncToGoogle: false,
        },
      });
      contactCount += 1;
    }

    for (const row of linkedInLeads) {
      const { firstName, lastName } = splitName(row.name);
      await tx.customerContact.create({
        data: {
          customerId: customer.id,
          firstName,
          lastName,
          role: row.role,
          linkedInUrl: row.linkedIn,
          country: row.country,
          notes: notes({
            prio: row.prio,
            unit: row.unit,
            country: row.country,
            extra: 'LinkedIn-Lead – keine verifizierte öffentliche E-Mail',
          }),
          isProjectContact: true,
          preferredContactMethod: 'PHONE',
          syncToGoogle: false,
        },
      });
      contactCount += 1;
    }

    let emailCount = 0;
    for (const row of companyEmails) {
      await tx.customerEmail.create({
        data: {
          customerId: customer.id,
          email: row.email,
          emailType: 'GENERAL',
          label: `${row.label} · ${row.unit} · Tel ${row.phone} · Prio ${row.prio}`,
          isPrimary: emailCount === 0,
        },
      });
      emailCount += 1;
    }

    return {
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      contacts: contactCount,
      emails: emailCount,
    };
  });

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
