/**
 * Office – Seed-Daten
 * Idempotent: Mehrfaches Ausführen aktualisiert vorhandene Datensätze (upsert).
 *
 * Ausführen:  pnpm prisma db seed
 */
import {
  BreakScopeType,
  CustomerStatus,
  EquipmentCategory,
  GpsEventType,
  InvoiceLineType,
  InvoiceStatus,
  InvoiceType,
  LanguageProficiency,
  PrismaClient,
  Priority,
  ProjectStatus,
  RoleCode,
  ServiceType,
  SignerType,
  TimeEntryType,
  WeeklyTimesheetStatus,
  WorkerAvailability,
  WorkerType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// ── Stammdaten-Definitionen ────────────────────────────────────

const ROLES: { code: RoleCode; name: string; description: string }[] = [
  { code: RoleCode.SUPERADMIN, name: 'Super-Administrator', description: 'Vollzugriff inkl. Benutzerverwaltung' },
  { code: RoleCode.OFFICE, name: 'Büro', description: 'Verwaltung ohne Benutzerverwaltung' },
  { code: RoleCode.PROJECT_MANAGER, name: 'Projektleiter', description: 'Projektsteuerung und Stundenzettel' },
  { code: RoleCode.WORKER, name: 'Monteur', description: 'Mobile Zeiterfassung, eigene Daten' },
];

const PERMISSIONS: string[] = [
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'workers.view',
  'workers.create',
  'workers.edit',
  'workers.delete',
  'timesheets.view',
  'timesheets.create',
  'timesheets.sign',
  'settings.manage',
  'users.manage',
];

/** Berechtigungen pro Rolle. */
const ROLE_PERMISSIONS: Record<RoleCode, (perm: string) => boolean> = {
  [RoleCode.SUPERADMIN]: () => true,
  [RoleCode.OFFICE]: (perm) => perm !== 'users.manage',
  [RoleCode.PROJECT_MANAGER]: (perm) =>
    perm.endsWith('.view') || perm === 'projects.edit' || perm.startsWith('timesheets.'),
  [RoleCode.WORKER]: (perm) => perm.endsWith('.view'),
};

const USERS: { email: string; password: string; displayName: string; role: RoleCode }[] = [
  { email: 'admin@office.local', password: 'admin123', displayName: 'Administrator', role: RoleCode.SUPERADMIN },
  { email: 'buero@office.local', password: 'buero123', displayName: 'Büro Mitarbeiter', role: RoleCode.OFFICE },
  { email: 'pl@office.local', password: 'pl123', displayName: 'Projektleiter', role: RoleCode.PROJECT_MANAGER },
];

// ── Beispielkunden-Definition ──────────────────────────────────

interface BranchSpec {
  name: string;
  branchType: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
}

interface ContactSpec {
  title?: string;
  firstName: string;
  lastName: string;
  role?: string;
  department?: string;
  branchName?: string; // Zuordnung über Branch-Name, sonst Hauptsitz
  email?: string;
  phoneMobile?: string;
  phoneLandline?: string;
  birthday?: string;
  isAccountingContact?: boolean;
  isProjectContact?: boolean;
  isSignatory?: boolean;
}

interface EmailSpec {
  email: string;
  emailType: string;
  isPrimary?: boolean;
}

interface BankSpec {
  bankName: string;
  iban: string;
  bic?: string;
  accountHolder?: string;
  isPrimary?: boolean;
}

interface CustomerSpec {
  customerNumber: string;
  companyName: string;
  legalForm?: string;
  industry?: string;
  rating?: string;
  paymentTermDays?: number;
  phone?: string;
  website?: string;
  vatId?: string;
  taxNumber?: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  branches: BranchSpec[];
  contacts: ContactSpec[];
  emails: EmailSpec[];
  bankAccounts: BankSpec[];
}

const EXAMPLE_CUSTOMERS: CustomerSpec[] = [
  {
    customerNumber: 'K-2026-0001',
    companyName: 'Nordlicht Sicherheitstechnik GmbH',
    legalForm: 'GmbH',
    industry: 'Sicherheitstechnik',
    rating: 'A',
    paymentTermDays: 14,
    phone: '+49 40 5550100',
    website: 'https://nordlicht-sicherheit.example',
    vatId: 'DE271234567',
    taxNumber: '22/815/00123',
    addressLine1: 'Hafenstraße 12',
    postalCode: '20457',
    city: 'Hamburg',
    country: 'DE',
    latitude: 53.5413,
    longitude: 9.9846,
    notes: 'Schlüsselkunde im Bereich Videoüberwachung.',
    branches: [
      {
        name: 'Hauptsitz Hamburg',
        branchType: 'HEADQUARTERS',
        addressLine1: 'Hafenstraße 12',
        postalCode: '20457',
        city: 'Hamburg',
        country: 'DE',
        phone: '+49 40 5550100',
        email: 'hamburg@nordlicht-sicherheit.example',
        latitude: 53.5413,
        longitude: 9.9846,
      },
      {
        name: 'Lager Bremen',
        branchType: 'WAREHOUSE',
        addressLine1: 'Industrieweg 5',
        postalCode: '28197',
        city: 'Bremen',
        country: 'DE',
        phone: '+49 421 5550200',
      },
    ],
    contacts: [
      {
        title: 'Herr',
        firstName: 'Lars',
        lastName: 'Petersen',
        role: 'Geschäftsführer',
        department: 'Geschäftsführung',
        branchName: 'Hauptsitz Hamburg',
        email: 'l.petersen@nordlicht-sicherheit.example',
        phoneMobile: '+49 170 1112233',
        birthday: '1978-03-12',
        isProjectContact: true,
        isSignatory: true,
      },
      {
        title: 'Frau',
        firstName: 'Sabine',
        lastName: 'Wolf',
        role: 'Buchhaltung',
        department: 'Finanzen',
        branchName: 'Hauptsitz Hamburg',
        email: 's.wolf@nordlicht-sicherheit.example',
        phoneLandline: '+49 40 5550110',
        isAccountingContact: true,
      },
      {
        title: 'Herr',
        firstName: 'Murat',
        lastName: 'Yilmaz',
        role: 'Lagerleiter',
        branchName: 'Lager Bremen',
        email: 'm.yilmaz@nordlicht-sicherheit.example',
        phoneMobile: '+49 171 2223344',
      },
    ],
    emails: [
      { email: 'info@nordlicht-sicherheit.example', emailType: 'GENERAL', isPrimary: true },
      { email: 'rechnung@nordlicht-sicherheit.example', emailType: 'BILLING' },
      { email: 'service@nordlicht-sicherheit.example', emailType: 'SERVICE' },
    ],
    bankAccounts: [
      {
        bankName: 'Hamburger Sparkasse',
        iban: 'DE89200505501234567890',
        bic: 'HASPDEHHXXX',
        accountHolder: 'Nordlicht Sicherheitstechnik GmbH',
        isPrimary: true,
      },
    ],
  },
  {
    customerNumber: 'K-2026-0002',
    companyName: 'Sonnenschein Elektro AG',
    legalForm: 'AG',
    industry: 'Elektroinstallation',
    rating: 'B',
    paymentTermDays: 30,
    phone: '+49 89 5550300',
    website: 'https://sonnenschein-elektro.example',
    vatId: 'DE301234567',
    addressLine1: 'Lindwurmstraße 88',
    postalCode: '80337',
    city: 'München',
    country: 'DE',
    latitude: 48.1278,
    longitude: 11.5614,
    branches: [
      {
        name: 'Zentrale München',
        branchType: 'HEADQUARTERS',
        addressLine1: 'Lindwurmstraße 88',
        postalCode: '80337',
        city: 'München',
        country: 'DE',
        phone: '+49 89 5550300',
        email: 'muenchen@sonnenschein-elektro.example',
        latitude: 48.1278,
        longitude: 11.5614,
      },
    ],
    contacts: [
      {
        title: 'Frau',
        firstName: 'Petra',
        lastName: 'Sonnenschein',
        role: 'Vorstand',
        department: 'Vorstand',
        email: 'p.sonnenschein@sonnenschein-elektro.example',
        phoneMobile: '+49 172 3334455',
        birthday: '1969-07-25',
        isProjectContact: true,
        isSignatory: true,
      },
      {
        title: 'Herr',
        firstName: 'Tobias',
        lastName: 'Klein',
        role: 'Projektleiter',
        department: 'Technik',
        email: 't.klein@sonnenschein-elektro.example',
        phoneMobile: '+49 173 4445566',
      },
    ],
    emails: [
      { email: 'info@sonnenschein-elektro.example', emailType: 'GENERAL', isPrimary: true },
      { email: 'buchhaltung@sonnenschein-elektro.example', emailType: 'BILLING' },
    ],
    bankAccounts: [
      {
        bankName: 'Stadtsparkasse München',
        iban: 'DE12701500000123456789',
        bic: 'SSKMDEMMXXX',
        accountHolder: 'Sonnenschein Elektro AG',
        isPrimary: true,
      },
    ],
  },
  {
    customerNumber: 'K-2026-0003',
    companyName: 'Rheinblick Facility Services',
    legalForm: 'GmbH & Co. KG',
    industry: 'Gebäudemanagement',
    rating: 'C',
    paymentTermDays: 21,
    phone: '+49 221 5550400',
    website: 'https://rheinblick-facility.example',
    addressLine1: 'Rheinuferstraße 3',
    postalCode: '50678',
    city: 'Köln',
    country: 'DE',
    latitude: 50.9233,
    longitude: 6.9606,
    branches: [
      {
        name: 'Standort Köln',
        branchType: 'OFFICE',
        addressLine1: 'Rheinuferstraße 3',
        postalCode: '50678',
        city: 'Köln',
        country: 'DE',
        phone: '+49 221 5550400',
        latitude: 50.9233,
        longitude: 6.9606,
      },
    ],
    contacts: [
      {
        title: 'Herr',
        firstName: 'Dirk',
        lastName: 'Bauer',
        role: 'Objektleiter',
        email: 'd.bauer@rheinblick-facility.example',
        phoneMobile: '+49 174 5556677',
        isProjectContact: true,
      },
      {
        title: 'Frau',
        firstName: 'Anja',
        lastName: 'Hoffmann',
        role: 'Buchhaltung',
        department: 'Verwaltung',
        email: 'a.hoffmann@rheinblick-facility.example',
        phoneLandline: '+49 221 5550410',
        isAccountingContact: true,
      },
      {
        title: 'Herr',
        firstName: 'Kevin',
        lastName: 'Schulz',
        role: 'Haustechnik',
        email: 'k.schulz@rheinblick-facility.example',
        phoneMobile: '+49 175 6667788',
      },
      {
        title: 'Frau',
        firstName: 'Laura',
        lastName: 'Becker',
        role: 'Disposition',
        email: 'l.becker@rheinblick-facility.example',
        phoneMobile: '+49 176 7778899',
        isSignatory: true,
      },
    ],
    emails: [
      { email: 'info@rheinblick-facility.example', emailType: 'GENERAL', isPrimary: true },
      { email: 'support@rheinblick-facility.example', emailType: 'SUPPORT' },
    ],
    bankAccounts: [],
  },
];

/** Legt die Beispielkunden idempotent inkl. aller Unter-Entities an. */
async function seedExampleCustomers(): Promise<void> {
  for (const spec of EXAMPLE_CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { customerNumber: spec.customerNumber },
      update: {},
      create: {
        customerNumber: spec.customerNumber,
        companyName: spec.companyName,
        legalForm: spec.legalForm,
        status: CustomerStatus.ACTIVE,
        industry: spec.industry,
        rating: spec.rating,
        paymentTermDays: spec.paymentTermDays,
        phone: spec.phone,
        website: spec.website,
        vatId: spec.vatId,
        taxNumber: spec.taxNumber,
        addressLine1: spec.addressLine1,
        postalCode: spec.postalCode,
        city: spec.city,
        country: spec.country,
        latitude: spec.latitude,
        longitude: spec.longitude,
        notes: spec.notes,
      },
    });

    // Branches
    const branchByName = new Map<string, string>();
    for (const b of spec.branches) {
      let branch = await prisma.customerBranch.findFirst({
        where: { customerId: customer.id, name: b.name },
      });
      if (!branch) {
        branch = await prisma.customerBranch.create({
          data: {
            customerId: customer.id,
            name: b.name,
            branchType: b.branchType,
            addressLine1: b.addressLine1,
            postalCode: b.postalCode,
            city: b.city,
            country: b.country,
            phone: b.phone,
            email: b.email,
            latitude: b.latitude,
            longitude: b.longitude,
          },
        });
      }
      branchByName.set(b.name, branch.id);
    }

    // Contacts
    for (const c of spec.contacts) {
      const existing = await prisma.customerContact.findFirst({
        where: {
          customerId: customer.id,
          firstName: c.firstName,
          lastName: c.lastName,
        },
      });
      if (!existing) {
        await prisma.customerContact.create({
          data: {
            customerId: customer.id,
            branchId: c.branchName ? branchByName.get(c.branchName) : undefined,
            title: c.title,
            firstName: c.firstName,
            lastName: c.lastName,
            role: c.role,
            department: c.department,
            email: c.email,
            phoneMobile: c.phoneMobile,
            phoneLandline: c.phoneLandline,
            birthday: c.birthday ? new Date(c.birthday) : undefined,
            isAccountingContact: c.isAccountingContact ?? false,
            isProjectContact: c.isProjectContact ?? false,
            isSignatory: c.isSignatory ?? false,
          },
        });
      }
    }

    // Emails
    for (const e of spec.emails) {
      const existing = await prisma.customerEmail.findFirst({
        where: { customerId: customer.id, email: e.email },
      });
      if (!existing) {
        await prisma.customerEmail.create({
          data: {
            customerId: customer.id,
            email: e.email,
            emailType: e.emailType,
            isPrimary: e.isPrimary ?? false,
          },
        });
      }
    }

    // Bank accounts
    for (const bank of spec.bankAccounts) {
      const existing = await prisma.customerBankAccount.findFirst({
        where: { customerId: customer.id, iban: bank.iban },
      });
      if (!existing) {
        await prisma.customerBankAccount.create({
          data: {
            customerId: customer.id,
            bankName: bank.bankName,
            iban: bank.iban,
            bic: bank.bic,
            accountHolder: bank.accountHolder,
            isPrimary: bank.isPrimary ?? false,
          },
        });
      }
    }
  }
}

// ── Beispielprojekte-Definition ────────────────────────────────

interface ProjectSiteSpec {
  name: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  accessInfo?: string;
  notes?: string;
  sortOrder?: number;
}

interface ProjectEquipmentSpec {
  name: string;
  description?: string;
  quantity?: number;
  serialNumber?: string;
  issuedTo?: string;
  condition?: string;
  returned?: boolean;
  notes?: string;
}

interface ProjectAssignmentSpec {
  workerNumber: string;
  roleName?: string;
  isLead?: boolean;
  active?: boolean;
  notes?: string;
}

interface StatusHistorySpec {
  fromStatus?: string | null;
  toStatus: string;
  comment?: string;
}

interface ProjectSpec {
  projectNumber: string;
  customerNumber: string;
  branchName?: string;
  title: string;
  description?: string;
  serviceType: ServiceType;
  status: ProjectStatus;
  priority: Priority;
  siteName?: string;
  siteAddressLine1?: string;
  sitePostalCode?: string;
  siteCity?: string;
  siteCountry?: string;
  latitude?: number;
  longitude?: number;
  siteAccessInfo?: string;
  siteWorkingHours?: string;
  billingMode?: string;
  weeklyPackageHours?: number;
  weeklyPackagePrice?: number;
  overtimeRatePerHour?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  notes?: string;
  sites: ProjectSiteSpec[];
  equipment: ProjectEquipmentSpec[];
  assignments: ProjectAssignmentSpec[];
  statusHistory: StatusHistorySpec[];
}

/** Zusätzliche Beispielmonteure für Projektzuordnungen. */
const EXAMPLE_WORKERS: { workerNumber: string; firstName: string; lastName: string }[] = [
  { workerNumber: 'M-0002', firstName: 'Jonas', lastName: 'Berger' },
  { workerNumber: 'M-0003', firstName: 'Sven', lastName: 'Krause' },
];

const EXAMPLE_PROJECTS: ProjectSpec[] = [
  {
    projectNumber: 'PRJ-2026-0001',
    customerNumber: 'K-2026-0001',
    branchName: 'Hauptsitz Hamburg',
    title: 'Videoüberwachung Hafenterminal',
    description: 'Komplettausstattung des Hafenterminals mit IP-Videotechnik.',
    serviceType: ServiceType.VIDEO,
    status: ProjectStatus.ACTIVE,
    priority: Priority.HIGH,
    siteName: 'Hafenterminal Hamburg',
    siteAddressLine1: 'Hafenstraße 12',
    sitePostalCode: '20457',
    siteCity: 'Hamburg',
    siteCountry: 'DE',
    latitude: 53.5413,
    longitude: 9.9846,
    siteAccessInfo: 'Anmeldung an der Hafeneinfahrt, Werkschutz Tor 3.',
    siteWorkingHours: 'Mo–Fr 07:00–16:00',
    billingMode: 'HOURLY_PACKAGE',
    weeklyPackageHours: 40,
    weeklyPackagePrice: 3200,
    overtimeRatePerHour: 65,
    plannedStartDate: '2026-07-06',
    plannedEndDate: '2026-09-30',
    actualStartDate: '2026-07-06',
    notes: 'Schlüsselprojekt, regelmäßige Abstimmung mit dem Werkschutz.',
    sites: [
      {
        name: 'Gebäude A – Verwaltung',
        addressLine1: 'Hafenstraße 12',
        postalCode: '20457',
        city: 'Hamburg',
        country: 'DE',
        latitude: 53.5413,
        longitude: 9.9846,
        accessInfo: 'Zutritt über Empfang, Besucherausweis erforderlich.',
        sortOrder: 1,
      },
      {
        name: 'Außenbereich – Kaikante',
        addressLine1: 'Hafenstraße 12',
        postalCode: '20457',
        city: 'Hamburg',
        country: 'DE',
        accessInfo: 'PSA Pflicht (Helm, Warnweste).',
        sortOrder: 2,
      },
    ],
    equipment: [],
    assignments: [
      { workerNumber: 'M-0001', roleName: 'Teamleiter', isLead: true },
      { workerNumber: 'M-0002', roleName: 'Monteur' },
    ],
    statusHistory: [
      { fromStatus: null, toStatus: 'DRAFT', comment: 'Projekt angelegt.' },
      { fromStatus: 'DRAFT', toStatus: 'PLANNED', comment: 'Terminierung abgeschlossen.' },
      { fromStatus: 'PLANNED', toStatus: 'ACTIVE', comment: 'Montage gestartet.' },
    ],
  },
  {
    projectNumber: 'PRJ-2026-0002',
    customerNumber: 'K-2026-0002',
    branchName: 'Zentrale München',
    title: 'Elektroinstallation Neubau Süd',
    description: 'Elektrische Erstinstallation für den Bürokomplex Neubau Süd.',
    serviceType: ServiceType.ELECTRICAL,
    status: ProjectStatus.PLANNED,
    priority: Priority.MEDIUM,
    siteName: 'Neubau Süd',
    siteAddressLine1: 'Lindwurmstraße 88',
    sitePostalCode: '80337',
    siteCity: 'München',
    siteCountry: 'DE',
    latitude: 48.1278,
    longitude: 11.5614,
    siteWorkingHours: 'Mo–Fr 08:00–17:00',
    billingMode: 'UNIT_BASED',
    plannedStartDate: '2026-08-03',
    plannedEndDate: '2026-11-13',
    sites: [
      {
        name: 'Etage EG–3',
        addressLine1: 'Lindwurmstraße 88',
        postalCode: '80337',
        city: 'München',
        country: 'DE',
        latitude: 48.1278,
        longitude: 11.5614,
        sortOrder: 1,
      },
    ],
    equipment: [
      {
        name: 'Bohrhammer Hilti TE 70',
        description: 'Kombihammer für Kernbohrungen',
        quantity: 1,
        serialNumber: 'HIL-TE70-4471',
        issuedTo: 'Jonas Berger',
        condition: 'Sehr gut',
      },
      {
        name: 'Kabeltrommel 50m',
        description: 'CEE 400V Baustromtrommel',
        quantity: 2,
        issuedTo: 'Sven Krause',
        condition: 'Gebrauchsspuren',
      },
    ],
    assignments: [
      { workerNumber: 'M-0002', roleName: 'Teamleiter', isLead: true },
      { workerNumber: 'M-0003', roleName: 'Monteur' },
    ],
    statusHistory: [
      { fromStatus: null, toStatus: 'DRAFT', comment: 'Projekt angelegt.' },
      { fromStatus: 'DRAFT', toStatus: 'PLANNED', comment: 'Material disponiert.' },
    ],
  },
  {
    projectNumber: 'PRJ-2026-0003',
    customerNumber: 'K-2026-0003',
    branchName: 'Standort Köln',
    title: 'Wartung Schließanlage Rheinblick',
    description: 'Jährliche Wartung der Zutritts- und Schließanlage.',
    serviceType: ServiceType.SERVICE,
    status: ProjectStatus.COMPLETED,
    priority: Priority.LOW,
    siteName: 'Objekt Rheinblick',
    siteAddressLine1: 'Rheinuferstraße 3',
    sitePostalCode: '50678',
    siteCity: 'Köln',
    siteCountry: 'DE',
    latitude: 50.9233,
    longitude: 6.9606,
    billingMode: 'HOURLY_PACKAGE',
    weeklyPackageHours: 16,
    weeklyPackagePrice: 1200,
    plannedStartDate: '2026-05-04',
    plannedEndDate: '2026-05-15',
    actualStartDate: '2026-05-04',
    actualEndDate: '2026-05-14',
    notes: 'Abnahme durch Objektleiter erfolgt.',
    sites: [],
    equipment: [],
    assignments: [
      { workerNumber: 'M-0003', roleName: 'Monteur', active: false },
    ],
    statusHistory: [
      { fromStatus: null, toStatus: 'DRAFT', comment: 'Projekt angelegt.' },
      { fromStatus: 'DRAFT', toStatus: 'PLANNED', comment: 'Wartungstermin vereinbart.' },
      { fromStatus: 'PLANNED', toStatus: 'ACTIVE', comment: 'Wartung gestartet.' },
      { fromStatus: 'ACTIVE', toStatus: 'COMPLETED', comment: 'Abnahme erfolgt, Projekt abgeschlossen.' },
    ],
  },
  {
    projectNumber: 'PRJ-2026-0004',
    customerNumber: 'K-2026-0001',
    branchName: 'Lager Bremen',
    title: 'Standortvernetzung Lager Bremen',
    description: 'Geplante Netzwerk- und Sicherheitsinfrastruktur für das Bremer Lager.',
    serviceType: ServiceType.OTHER,
    status: ProjectStatus.DRAFT,
    priority: Priority.URGENT,
    siteName: 'Lager Bremen',
    siteAddressLine1: 'Industrieweg 5',
    sitePostalCode: '28197',
    siteCity: 'Bremen',
    siteCountry: 'DE',
    billingMode: 'MIXED',
    notes: 'Noch in der Angebotsphase.',
    sites: [],
    equipment: [],
    assignments: [],
    statusHistory: [
      { fromStatus: null, toStatus: 'DRAFT', comment: 'Projekt angelegt.' },
    ],
  },
];

/** Legt die Beispielprojekte idempotent inkl. Unter-Entities an. */
async function seedExampleProjects(): Promise<void> {
  const pmUser = await prisma.user.findUnique({
    where: { email: 'pl@office.local' },
  });

  // Zusätzliche Monteure
  const workerByNumber = new Map<string, string>();
  for (const w of EXAMPLE_WORKERS) {
    const worker = await prisma.worker.upsert({
      where: { workerNumber: w.workerNumber },
      update: {},
      create: {
        workerNumber: w.workerNumber,
        firstName: w.firstName,
        lastName: w.lastName,
        languageCode: 'de',
        active: true,
      },
    });
    workerByNumber.set(w.workerNumber, worker.id);
  }
  // Bestehenden Beispielmonteur M-0001 ebenfalls referenzierbar machen
  const m1 = await prisma.worker.findUnique({ where: { workerNumber: 'M-0001' } });
  if (m1) workerByNumber.set('M-0001', m1.id);

  for (const spec of EXAMPLE_PROJECTS) {
    const customer = await prisma.customer.findUnique({
      where: { customerNumber: spec.customerNumber },
    });
    if (!customer) continue;

    let branchId: string | undefined;
    if (spec.branchName) {
      const branch = await prisma.customerBranch.findFirst({
        where: { customerId: customer.id, name: spec.branchName },
      });
      branchId = branch?.id;
    }

    const primaryContact = await prisma.customerContact.findFirst({
      where: { customerId: customer.id, isProjectContact: true },
    });

    const project = await prisma.project.upsert({
      where: { projectNumber: spec.projectNumber },
      update: {},
      create: {
        projectNumber: spec.projectNumber,
        customerId: customer.id,
        branchId,
        title: spec.title,
        description: spec.description,
        serviceType: spec.serviceType,
        status: spec.status,
        priority: spec.priority,
        siteName: spec.siteName,
        siteAddressLine1: spec.siteAddressLine1,
        sitePostalCode: spec.sitePostalCode,
        siteCity: spec.siteCity,
        siteCountry: spec.siteCountry,
        latitude: spec.latitude,
        longitude: spec.longitude,
        siteAccessInfo: spec.siteAccessInfo,
        siteWorkingHours: spec.siteWorkingHours,
        billingMode: spec.billingMode,
        weeklyPackageHours: spec.weeklyPackageHours,
        weeklyPackagePrice: spec.weeklyPackagePrice,
        overtimeRatePerHour: spec.overtimeRatePerHour,
        plannedStartDate: spec.plannedStartDate ? new Date(spec.plannedStartDate) : undefined,
        plannedEndDate: spec.plannedEndDate ? new Date(spec.plannedEndDate) : undefined,
        actualStartDate: spec.actualStartDate ? new Date(spec.actualStartDate) : undefined,
        actualEndDate: spec.actualEndDate ? new Date(spec.actualEndDate) : undefined,
        internalProjectManagerUserId: pmUser?.id,
        primaryCustomerContactId: primaryContact?.id,
        notes: spec.notes,
      },
    });

    // Sites
    for (const s of spec.sites) {
      const existing = await prisma.projectSite.findFirst({
        where: { projectId: project.id, name: s.name },
      });
      if (!existing) {
        await prisma.projectSite.create({
          data: {
            projectId: project.id,
            name: s.name,
            addressLine1: s.addressLine1,
            postalCode: s.postalCode,
            city: s.city,
            country: s.country,
            latitude: s.latitude,
            longitude: s.longitude,
            accessInfo: s.accessInfo,
            notes: s.notes,
            sortOrder: s.sortOrder ?? 0,
          },
        });
      }
    }

    // Equipment
    for (const e of spec.equipment) {
      const existing = await prisma.projectEquipment.findFirst({
        where: { projectId: project.id, name: e.name },
      });
      if (!existing) {
        await prisma.projectEquipment.create({
          data: {
            projectId: project.id,
            name: e.name,
            description: e.description,
            quantity: e.quantity ?? 1,
            serialNumber: e.serialNumber,
            issuedTo: e.issuedTo,
            condition: e.condition,
            returnedAt: e.returned ? new Date() : undefined,
            notes: e.notes,
          },
        });
      }
    }

    // Assignments
    for (const a of spec.assignments) {
      const workerId = workerByNumber.get(a.workerNumber);
      if (!workerId) continue;
      const existing = await prisma.projectAssignment.findFirst({
        where: { projectId: project.id, workerId },
      });
      if (!existing) {
        await prisma.projectAssignment.create({
          data: {
            projectId: project.id,
            workerId,
            roleName: a.roleName,
            startDate: spec.actualStartDate
              ? new Date(spec.actualStartDate)
              : spec.plannedStartDate
                ? new Date(spec.plannedStartDate)
                : new Date(),
            endDate: spec.actualEndDate ? new Date(spec.actualEndDate) : undefined,
            active: a.active ?? true,
            isLead: a.isLead ?? false,
            notes: a.notes,
          },
        });
      }
    }

    // Status history
    const historyCount = await prisma.projectStatusHistory.count({
      where: { projectId: project.id },
    });
    if (historyCount === 0) {
      for (const h of spec.statusHistory) {
        await prisma.projectStatusHistory.create({
          data: {
            projectId: project.id,
            fromStatus: h.fromStatus ?? null,
            toStatus: h.toStatus,
            changedByUserId: pmUser?.id,
            comment: h.comment,
          },
        });
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Monteur-/Personalmodul (Subunternehmen, Monteure, Teams, …)
// ──────────────────────────────────────────────────────────────

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function yearsFromNow(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d;
}
function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

interface SubcontractorSeed {
  key: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
  taxNumber: string;
  vatId: string;
  iban: string;
  bic: string;
  bankName: string;
}

const SUBCONTRACTORS: SubcontractorSeed[] = [
  {
    key: 'kovacevic',
    name: 'Elektro Kovačević d.o.o.',
    contactPerson: 'Marko Kovačević',
    email: 'info@elektro-kovacevic.hr',
    phone: '+385 1 2345678',
    addressLine1: 'Ilica 100',
    postalCode: '10000',
    city: 'Zagreb',
    country: 'HR',
    taxNumber: '12345678901',
    vatId: 'HR12345678901',
    iban: 'HR1210010051863000160',
    bic: 'HAABHR22',
    bankName: 'Zagrebačka banka',
  },
  {
    key: 'baltic',
    name: 'Baltic Power Solutions',
    contactPerson: 'Piotr Wiśniewski',
    email: 'kontakt@balticpower.pl',
    phone: '+48 58 1234567',
    addressLine1: 'Długa 50',
    postalCode: '80-001',
    city: 'Gdańsk',
    country: 'PL',
    taxNumber: '5840000000',
    vatId: 'PL5840000000',
    iban: 'PL61109010140000071219812874',
    bic: 'WBKPPLPP',
    bankName: 'Santander Bank Polska',
  },
];

interface LanguageSeed {
  language: string;
  proficiency: LanguageProficiency;
}
interface CertSeed {
  name: string;
  issuedBy?: string;
  issuedDate?: Date;
  expiryDate?: Date;
}
interface WorkerSeed {
  workerNumber: string;
  firstName: string;
  lastName: string;
  nationality: string;
  role: string;
  workerType: WorkerType;
  subKey?: string;
  hourlyRate: number;
  dailyRate: number;
  oib?: string;
  passportNumber?: string;
  passportExpiry?: Date;
  residencePermitNumber?: string;
  residencePermitExpiry?: Date;
  workPermitNumber?: string;
  workPermitExpiry?: Date;
  languages: LanguageSeed[];
  certifications: CertSeed[];
}

const WORKERS: WorkerSeed[] = [
  {
    workerNumber: 'W-2026-0001',
    firstName: 'Marko',
    lastName: 'Kovačević',
    nationality: 'HR',
    role: 'Elektriker',
    workerType: WorkerType.SUBCONTRACTED,
    subKey: 'kovacevic',
    hourlyRate: 42,
    dailyRate: 336,
    oib: '12345678901',
    passportNumber: 'HR1234567',
    passportExpiry: yearsFromNow(4),
    residencePermitNumber: 'AT-RP-0001',
    residencePermitExpiry: daysFromNow(20), // läuft bald ab!
    languages: [
      { language: 'Kroatisch', proficiency: LanguageProficiency.NATIVE },
      { language: 'Deutsch', proficiency: LanguageProficiency.B1 },
    ],
    certifications: [
      {
        name: 'SCC Dok. 018',
        issuedBy: 'TÜV Süd',
        issuedDate: yearsAgo(2),
        expiryDate: yearsFromNow(1),
      },
      {
        name: 'Elektrofachkraft',
        issuedBy: 'Handwerkskammer',
        issuedDate: yearsAgo(5),
      },
    ],
  },
  {
    workerNumber: 'W-2026-0002',
    firstName: 'Ivan',
    lastName: 'Horvat',
    nationality: 'HR',
    role: 'Helfer',
    workerType: WorkerType.SUBCONTRACTED,
    subKey: 'kovacevic',
    hourlyRate: 28,
    dailyRate: 224,
    oib: '98765432109',
    passportNumber: 'HR7654321',
    passportExpiry: yearsFromNow(3),
    languages: [
      { language: 'Kroatisch', proficiency: LanguageProficiency.NATIVE },
      { language: 'Deutsch', proficiency: LanguageProficiency.A2 },
    ],
    certifications: [],
  },
  {
    workerNumber: 'W-2026-0003',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    nationality: 'PL',
    role: 'Elektriker',
    workerType: WorkerType.SUBCONTRACTED,
    subKey: 'baltic',
    hourlyRate: 40,
    dailyRate: 320,
    passportNumber: 'PL2233445',
    passportExpiry: yearsFromNow(5),
    languages: [
      { language: 'Polnisch', proficiency: LanguageProficiency.NATIVE },
      { language: 'Deutsch', proficiency: LanguageProficiency.B2 },
      { language: 'Englisch', proficiency: LanguageProficiency.B1 },
    ],
    certifications: [
      {
        name: 'SCC Dok. 017',
        issuedBy: 'DEKRA',
        issuedDate: yearsAgo(1),
        expiryDate: yearsFromNow(2),
      },
    ],
  },
  {
    workerNumber: 'W-2026-0004',
    firstName: 'Tomasz',
    lastName: 'Kowalski',
    nationality: 'PL',
    role: 'Helfer',
    workerType: WorkerType.SUBCONTRACTED,
    subKey: 'baltic',
    hourlyRate: 26,
    dailyRate: 208,
    passportNumber: 'PL5566778',
    passportExpiry: yearsFromNow(2),
    languages: [
      { language: 'Polnisch', proficiency: LanguageProficiency.NATIVE },
      { language: 'Deutsch', proficiency: LanguageProficiency.A1 },
    ],
    certifications: [],
  },
  {
    workerNumber: 'W-2026-0005',
    firstName: 'Stefan',
    lastName: 'Müller',
    nationality: 'DE',
    role: 'Elektriker',
    workerType: WorkerType.EMPLOYED,
    hourlyRate: 38,
    dailyRate: 304,
    languages: [
      { language: 'Deutsch', proficiency: LanguageProficiency.NATIVE },
      { language: 'Englisch', proficiency: LanguageProficiency.B2 },
    ],
    certifications: [
      {
        name: 'Elektrofachkraft',
        issuedBy: 'Handwerkskammer',
        issuedDate: yearsAgo(8),
      },
      {
        name: 'SCC Dok. 018',
        issuedBy: 'TÜV Süd',
        issuedDate: yearsAgo(1),
        expiryDate: yearsFromNow(2),
      },
      {
        name: 'Höhenarbeiter (PSAgA)',
        issuedBy: 'BG Bau',
        issuedDate: yearsAgo(1),
        expiryDate: yearsFromNow(1),
      },
      {
        name: 'Ersthelfer',
        issuedBy: 'DRK',
        issuedDate: yearsAgo(1),
        expiryDate: yearsFromNow(1),
      },
    ],
  },
  {
    workerNumber: 'W-2026-0006',
    firstName: 'Ahmed',
    lastName: 'Özdemir',
    nationality: 'TR',
    role: 'Elektriker',
    workerType: WorkerType.EMPLOYED,
    hourlyRate: 36,
    dailyRate: 288,
    workPermitNumber: 'DE-WP-2024-0006',
    workPermitExpiry: yearsFromNow(1),
    languages: [
      { language: 'Türkisch', proficiency: LanguageProficiency.NATIVE },
      { language: 'Deutsch', proficiency: LanguageProficiency.C1 },
      { language: 'Englisch', proficiency: LanguageProficiency.A2 },
    ],
    certifications: [
      {
        name: 'Elektrofachkraft',
        issuedBy: 'Handwerkskammer',
        issuedDate: yearsAgo(3),
      },
      {
        name: 'DGUV V3',
        issuedBy: 'TÜV Rheinland',
        issuedDate: yearsAgo(1),
        expiryDate: yearsFromNow(2),
      },
    ],
  },
];

interface TeamSeed {
  name: string;
  description: string;
  leaderNumber: string;
  members: { workerNumber: string; role: string }[];
}

const TEAMS: TeamSeed[] = [
  {
    name: 'Team Hafenterminal',
    description: 'Montageteam für das Projekt Videoüberwachung Hafenterminal.',
    leaderNumber: 'W-2026-0001',
    members: [
      { workerNumber: 'W-2026-0001', role: 'Teamleiter' },
      { workerNumber: 'W-2026-0002', role: 'Helfer' },
      { workerNumber: 'W-2026-0003', role: 'Elektriker' },
    ],
  },
  {
    name: 'Team Neubau Süd',
    description: 'Montageteam für die Elektroinstallation Neubau Süd.',
    leaderNumber: 'W-2026-0005',
    members: [
      { workerNumber: 'W-2026-0005', role: 'Teamleiter' },
      { workerNumber: 'W-2026-0006', role: 'Elektriker' },
      { workerNumber: 'W-2026-0004', role: 'Helfer' },
    ],
  },
];

// Projektnr. → zugewiesene Monteure (mit Teamleiter-Flag)
const WORKER_ASSIGNMENTS: {
  projectNumber: string;
  workers: { workerNumber: string; isLead: boolean }[];
}[] = [
  {
    projectNumber: 'PRJ-2026-0001', // Videoüberwachung Hafenterminal
    workers: [
      { workerNumber: 'W-2026-0001', isLead: true },
      { workerNumber: 'W-2026-0002', isLead: false },
      { workerNumber: 'W-2026-0003', isLead: false },
    ],
  },
  {
    projectNumber: 'PRJ-2026-0002', // Elektroinstallation Neubau Süd
    workers: [
      { workerNumber: 'W-2026-0005', isLead: true },
      { workerNumber: 'W-2026-0006', isLead: false },
      { workerNumber: 'W-2026-0004', isLead: false },
    ],
  },
];

interface EquipmentSeed {
  itemNumber: string;
  name: string;
  category: EquipmentCategory;
}
const EQUIPMENT_ITEMS: EquipmentSeed[] = [
  { itemNumber: 'E-1001', name: 'Hilti Bohrmaschine', category: EquipmentCategory.TOOL },
  { itemNumber: 'E-1002', name: 'Multimeter', category: EquipmentCategory.ELECTRONICS },
  { itemNumber: 'E-1003', name: 'Werkzeugkoffer', category: EquipmentCategory.TOOL },
  { itemNumber: 'E-1004', name: 'PSA-Set', category: EquipmentCategory.PSA },
];

// Monteur → ausgegebene Equipment-Items
const EQUIPMENT_ISSUES: { workerNumber: string; itemNumbers: string[] }[] = [
  { workerNumber: 'W-2026-0001', itemNumbers: ['E-1001', 'E-1002'] },
  { workerNumber: 'W-2026-0005', itemNumbers: ['E-1003', 'E-1004'] },
];

async function seedWorkersModule(): Promise<void> {
  // ── Subunternehmen ───────────────────────────────────────────
  const subIdByKey = new Map<string, string>();
  for (const s of SUBCONTRACTORS) {
    const existing = await prisma.subcontractor.findFirst({
      where: { name: s.name },
    });
    const data = {
      name: s.name,
      contactPerson: s.contactPerson,
      email: s.email,
      phone: s.phone,
      addressLine1: s.addressLine1,
      postalCode: s.postalCode,
      city: s.city,
      country: s.country,
      taxNumber: s.taxNumber,
      vatId: s.vatId,
      iban: s.iban,
      bic: s.bic,
      bankName: s.bankName,
      active: true,
    };
    const sub = existing
      ? await prisma.subcontractor.update({ where: { id: existing.id }, data })
      : await prisma.subcontractor.create({ data });
    subIdByKey.set(s.key, sub.id);
  }

  // ── Monteure (+ Sprachen + Zertifikate) ──────────────────────
  const workerIdByNumber = new Map<string, string>();
  for (const w of WORKERS) {
    const data = {
      firstName: w.firstName,
      lastName: w.lastName,
      nationality: w.nationality,
      workerType: w.workerType,
      availability: WorkerAvailability.ON_PROJECT,
      hourlyRate: w.hourlyRate,
      dailyRate: w.dailyRate,
      oib: w.oib ?? null,
      passportNumber: w.passportNumber ?? null,
      passportExpiry: w.passportExpiry ?? null,
      residencePermitNumber: w.residencePermitNumber ?? null,
      residencePermitExpiry: w.residencePermitExpiry ?? null,
      workPermitNumber: w.workPermitNumber ?? null,
      workPermitExpiry: w.workPermitExpiry ?? null,
      subcontractorId: w.subKey ? (subIdByKey.get(w.subKey) ?? null) : null,
      contractStart: yearsAgo(1),
      active: true,
    };
    const worker = await prisma.worker.upsert({
      where: { workerNumber: w.workerNumber },
      update: data,
      create: { workerNumber: w.workerNumber, ...data },
    });
    workerIdByNumber.set(w.workerNumber, worker.id);

    for (const l of w.languages) {
      await prisma.workerLanguage.upsert({
        where: {
          workerId_language: { workerId: worker.id, language: l.language },
        },
        update: { proficiency: l.proficiency },
        create: {
          workerId: worker.id,
          language: l.language,
          proficiency: l.proficiency,
        },
      });
    }

    for (const c of w.certifications) {
      const existing = await prisma.workerCertification.findFirst({
        where: { workerId: worker.id, name: c.name },
      });
      if (!existing) {
        await prisma.workerCertification.create({
          data: {
            workerId: worker.id,
            name: c.name,
            issuedBy: c.issuedBy,
            issuedDate: c.issuedDate,
            expiryDate: c.expiryDate,
          },
        });
      }
    }
  }

  // ── Teams (+ Mitglieder) ─────────────────────────────────────
  for (const team of TEAMS) {
    const leaderId = workerIdByNumber.get(team.leaderNumber) ?? null;
    const existing = await prisma.workerTeam.findFirst({
      where: { name: team.name },
    });
    const record = existing
      ? await prisma.workerTeam.update({
          where: { id: existing.id },
          data: { description: team.description, leaderId, active: true },
        })
      : await prisma.workerTeam.create({
          data: {
            name: team.name,
            description: team.description,
            leaderId,
            active: true,
          },
        });

    for (const m of team.members) {
      const workerId = workerIdByNumber.get(m.workerNumber);
      if (!workerId) continue;
      const member = await prisma.workerTeamMember.findFirst({
        where: { teamId: record.id, workerId, leftAt: null },
      });
      if (!member) {
        await prisma.workerTeamMember.create({
          data: { teamId: record.id, workerId, role: m.role },
        });
      }
    }
  }

  // ── Projektzuweisungen ───────────────────────────────────────
  for (const spec of WORKER_ASSIGNMENTS) {
    const project = await prisma.project.findUnique({
      where: { projectNumber: spec.projectNumber },
    });
    if (!project) continue;
    for (const a of spec.workers) {
      const workerId = workerIdByNumber.get(a.workerNumber);
      if (!workerId) continue;
      const existing = await prisma.projectAssignment.findFirst({
        where: { projectId: project.id, workerId },
      });
      if (!existing) {
        await prisma.projectAssignment.create({
          data: {
            projectId: project.id,
            workerId,
            roleName: a.isLead ? 'Teamleiter' : 'Monteur',
            isLead: a.isLead,
            startDate: yearsAgo(0),
            active: true,
          },
        });
      }
    }
  }

  // ── Equipment-Items + Ausgaben ───────────────────────────────
  const equipmentIdByNumber = new Map<string, string>();
  for (const e of EQUIPMENT_ITEMS) {
    const item = await prisma.equipmentItem.upsert({
      where: { itemNumber: e.itemNumber },
      update: { name: e.name, category: e.category },
      create: {
        itemNumber: e.itemNumber,
        name: e.name,
        category: e.category,
        trackable: true,
        active: true,
      },
    });
    equipmentIdByNumber.set(e.itemNumber, item.id);
  }

  for (const issue of EQUIPMENT_ISSUES) {
    const workerId = workerIdByNumber.get(issue.workerNumber);
    if (!workerId) continue;
    for (const itemNumber of issue.itemNumbers) {
      const equipmentItemId = equipmentIdByNumber.get(itemNumber);
      if (!equipmentItemId) continue;
      const existing = await prisma.workerEquipmentIssue.findFirst({
        where: { workerId, equipmentItemId },
      });
      if (!existing) {
        await prisma.workerEquipmentIssue.create({
          data: {
            workerId,
            equipmentItemId,
            issuedAt: yearsAgo(0),
            conditionOut: 'einwandfrei',
          },
        });
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Zeiterfassung (PINs, Stempelungen, Stundenzettel, Pausenregeln)
// ──────────────────────────────────────────────────────────────

/**
 * 6-stellige Login-PINs der Seed-Monteure (Backend erfordert genau 6 Ziffern).
 * Abgeleitet aus den Wunsch-Codes 1001–1006 (links auf 6 Stellen aufgefüllt).
 */
const WORKER_PINS: { workerNumber: string; pin: string }[] = [
  { workerNumber: 'W-2026-0001', pin: '001001' }, // Marko
  { workerNumber: 'W-2026-0002', pin: '001002' }, // Ivan
  { workerNumber: 'W-2026-0003', pin: '001003' }, // Piotr
  { workerNumber: 'W-2026-0004', pin: '001004' }, // Tomasz
  { workerNumber: 'W-2026-0005', pin: '001005' }, // Stefan
  { workerNumber: 'W-2026-0006', pin: '001006' }, // Ahmed
];

/** Monteur → Projekt + Baustellen-Koordinaten (für GPS) + Pausenregel. */
const TIME_TRACKING: {
  workerNumber: string;
  projectNumber: string;
  latitude: number;
  longitude: number;
  /** true = strengere Hafenterminal-Pausenregel (>6h → 45min). */
  hafenterminal: boolean;
}[] = [
  { workerNumber: 'W-2026-0001', projectNumber: 'PRJ-2026-0001', latitude: 53.5413, longitude: 9.9846, hafenterminal: true },
  { workerNumber: 'W-2026-0002', projectNumber: 'PRJ-2026-0001', latitude: 53.5413, longitude: 9.9846, hafenterminal: true },
  { workerNumber: 'W-2026-0003', projectNumber: 'PRJ-2026-0001', latitude: 53.5413, longitude: 9.9846, hafenterminal: true },
  { workerNumber: 'W-2026-0005', projectNumber: 'PRJ-2026-0002', latitude: 48.1278, longitude: 11.5614, hafenterminal: false },
  { workerNumber: 'W-2026-0006', projectNumber: 'PRJ-2026-0002', latitude: 48.1278, longitude: 11.5614, hafenterminal: false },
  { workerNumber: 'W-2026-0004', projectNumber: 'PRJ-2026-0002', latitude: 48.1278, longitude: 11.5614, hafenterminal: false },
];

/** Montag 00:00 (lokal) der Woche eines Datums. */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay() || 7; // So=7
  d.setDate(d.getDate() - (dow - 1));
  return d;
}

/** ISO-Kalenderwoche + Jahr eines Datums. */
function isoWeek(date: Date): { weekYear: number; weekNumber: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { weekYear: d.getUTCFullYear(), weekNumber };
}

/** Datum + Uhrzeit (lokal) erzeugen. */
function at(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** ±maxMin Minuten Variation. */
function jitter(maxMin: number): number {
  return Math.round((Math.random() * 2 - 1) * maxMin);
}

/** Automatischer Pausenabzug analog der Backend-Regeln. */
function breakMinutesFor(gross: number, hafenterminal: boolean): number {
  if (hafenterminal) return gross >= 360 ? 45 : 0;
  if (gross >= 540) return 45;
  if (gross >= 360) return 30;
  return 0;
}

interface SeedDay {
  workDate: Date;
  clockIn: Date;
  clockOut: Date;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  latitude: number;
  longitude: number;
}

async function seedTimesheetsModule(): Promise<void> {
  // ── PINs ─────────────────────────────────────────────────────
  const workerIdByNumber = new Map<string, string>();
  for (const wp of WORKER_PINS) {
    const worker = await prisma.worker.findUnique({
      where: { workerNumber: wp.workerNumber },
    });
    if (!worker) continue;
    workerIdByNumber.set(wp.workerNumber, worker.id);
    const existing = await prisma.workerPin.findFirst({
      where: { workerId: worker.id, isActive: true },
    });
    const pinHash = await bcrypt.hash(wp.pin, SALT_ROUNDS);
    if (existing) {
      await prisma.workerPin.update({
        where: { id: existing.id },
        data: { pinHash, validFrom: yearsAgo(1), validTo: null, isActive: true },
      });
    } else {
      await prisma.workerPin.create({
        data: {
          workerId: worker.id,
          pinHash,
          validFrom: yearsAgo(1),
          isActive: true,
        },
      });
    }
  }

  // ── Hafenterminal-Pausenregel (projektspezifisch) ────────────
  const hafenProject = await prisma.project.findUnique({
    where: { projectNumber: 'PRJ-2026-0001' },
  });
  if (hafenProject) {
    const existingRule = await prisma.breakRule.findFirst({
      where: {
        scopeType: BreakScopeType.PROJECT,
        projectId: hafenProject.id,
        name: 'Hafenterminal-Pausen',
      },
    });
    if (!existingRule) {
      await prisma.breakRule.create({
        data: {
          scopeType: BreakScopeType.PROJECT,
          projectId: hafenProject.id,
          name: 'Hafenterminal-Pausen',
          autoDeductEnabled: true,
          thresholdMinutes1: 360,
          breakMinutes1: 45,
        },
      });
    }
  }

  // ── Stempelungen (letzte 2 Wochen) + Stundenzettel ───────────
  const thisMonday = mondayOf(new Date());
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const weeks = [
    { monday: lastMonday, approved: true },
    { monday: thisMonday, approved: false },
  ];
  const rangeStart = new Date(lastMonday);

  for (const tt of TIME_TRACKING) {
    const workerId = workerIdByNumber.get(tt.workerNumber);
    if (!workerId) continue;
    const project = await prisma.project.findUnique({
      where: { projectNumber: tt.projectNumber },
    });
    if (!project) continue;
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) continue;

    // Alte Seed-Daten im Zeitraum entfernen (idempotent).
    await prisma.gpsEvent.deleteMany({
      where: { workerId, recordedAt: { gte: rangeStart } },
    });
    await prisma.timeEntry.deleteMany({
      where: { workerId, occurredAtClient: { gte: rangeStart } },
    });

    for (const week of weeks) {
      const days: SeedDay[] = [];
      // Mo–Fr
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const clockIn = at(week.monday, dayOffset, 7, jitter(15));
        const clockOut = at(week.monday, dayOffset, 16, jitter(15));
        const gross = Math.max(
          0,
          Math.round((clockOut.getTime() - clockIn.getTime()) / 60000),
        );
        const brk = breakMinutesFor(gross, tt.hafenterminal);
        days.push({
          workDate: at(week.monday, dayOffset, 0, 0),
          clockIn,
          clockOut,
          grossMinutes: gross,
          breakMinutes: brk,
          netMinutes: Math.max(0, gross - brk),
          latitude: tt.latitude + (Math.random() - 0.5) * 0.001,
          longitude: tt.longitude + (Math.random() - 0.5) * 0.001,
        });
      }
      // Gelegentlich Samstag (halber Tag) – jeder zweite Monteur.
      if (tt.workerNumber.endsWith('1') || tt.workerNumber.endsWith('5')) {
        const clockIn = at(week.monday, 5, 7, jitter(15));
        const clockOut = at(week.monday, 5, 12, jitter(15));
        const gross = Math.max(
          0,
          Math.round((clockOut.getTime() - clockIn.getTime()) / 60000),
        );
        const brk = breakMinutesFor(gross, tt.hafenterminal);
        days.push({
          workDate: at(week.monday, 5, 0, 0),
          clockIn,
          clockOut,
          grossMinutes: gross,
          breakMinutes: brk,
          netMinutes: Math.max(0, gross - brk),
          latitude: tt.latitude + (Math.random() - 0.5) * 0.001,
          longitude: tt.longitude + (Math.random() - 0.5) * 0.001,
        });
      }

      // TimeEntries + GpsEvents erzeugen.
      for (const d of days) {
        const inEntry = await prisma.timeEntry.create({
          data: {
            workerId,
            projectId: project.id,
            entryType: TimeEntryType.CLOCK_IN,
            occurredAtClient: d.clockIn,
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 8,
            sourceDevice: 'Seed',
          },
        });
        await prisma.gpsEvent.create({
          data: {
            workerId,
            projectId: project.id,
            relatedTimeEntryId: inEntry.id,
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 8,
            recordedAt: d.clockIn,
            eventType: GpsEventType.CLOCK_IN,
          },
        });
        const outEntry = await prisma.timeEntry.create({
          data: {
            workerId,
            projectId: project.id,
            entryType: TimeEntryType.CLOCK_OUT,
            occurredAtClient: d.clockOut,
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 8,
            sourceDevice: 'Seed',
          },
        });
        await prisma.gpsEvent.create({
          data: {
            workerId,
            projectId: project.id,
            relatedTimeEntryId: outEntry.id,
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 8,
            recordedAt: d.clockOut,
            eventType: GpsEventType.CLOCK_OUT,
          },
        });
      }

      // Wochenstundenzettel (upsert) + Tage.
      const { weekYear, weekNumber } = isoWeek(week.monday);
      const totals = days.reduce(
        (acc, d) => ({
          gross: acc.gross + d.grossMinutes,
          brk: acc.brk + d.breakMinutes,
          net: acc.net + d.netMinutes,
        }),
        { gross: 0, brk: 0, net: 0 },
      );
      const status = week.approved
        ? WeeklyTimesheetStatus.APPROVED
        : WeeklyTimesheetStatus.DRAFT;
      const signedAt = at(week.monday, 6, 18, 0); // Sonntagabend

      const sheet = await prisma.weeklyTimesheet.upsert({
        where: {
          workerId_projectId_weekYear_weekNumber: {
            workerId,
            projectId: project.id,
            weekYear,
            weekNumber,
          },
        },
        create: {
          workerId,
          projectId: project.id,
          weekYear,
          weekNumber,
          status,
          totalMinutesGross: totals.gross,
          totalBreakMinutes: totals.brk,
          totalMinutesNet: totals.net,
          submittedAt: week.approved ? signedAt : null,
          reviewedAt: week.approved ? signedAt : null,
          approvedAt: week.approved ? signedAt : null,
        },
        update: {
          status,
          totalMinutesGross: totals.gross,
          totalBreakMinutes: totals.brk,
          totalMinutesNet: totals.net,
          submittedAt: week.approved ? signedAt : null,
          reviewedAt: week.approved ? signedAt : null,
          approvedAt: week.approved ? signedAt : null,
          rejectedAt: null,
          rejectionReason: null,
        },
      });

      await prisma.weeklyTimesheetDay.deleteMany({
        where: { weeklyTimesheetId: sheet.id },
      });
      await prisma.weeklyTimesheetDay.createMany({
        data: days.map((d) => ({
          weeklyTimesheetId: sheet.id,
          workDate: d.workDate,
          firstClockInAt: d.clockIn,
          lastClockOutAt: d.clockOut,
          grossMinutes: d.grossMinutes,
          breakMinutes: d.breakMinutes,
          netMinutes: d.netMinutes,
          clockInLatitude: d.latitude,
          clockInLongitude: d.longitude,
          clockOutLatitude: d.latitude,
          clockOutLongitude: d.longitude,
        })),
      });

      // Unterschriften nur für die genehmigte Vorwoche.
      await prisma.weeklyTimesheetSignature.deleteMany({
        where: { weeklyTimesheetId: sheet.id },
      });
      if (week.approved) {
        await prisma.weeklyTimesheetSignature.createMany({
          data: [
            {
              weeklyTimesheetId: sheet.id,
              signerType: SignerType.WORKER,
              signerName: `${worker.firstName} ${worker.lastName}`,
              signatureImagePath: `timesheets/${sheet.id}/signatures/WORKER.png`,
              signedAt,
            },
            {
              weeklyTimesheetId: sheet.id,
              signerType: SignerType.SUPERVISOR,
              signerName: 'Vorarbeiter',
              signerRole: 'Vorarbeiter',
              signatureImagePath: `timesheets/${sheet.id}/signatures/SUPERVISOR.png`,
              signedAt,
            },
          ],
        });
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Abrechnungsmodul (Aus-/Eingangsrechnungen mit Positionen + Zahlungen)
// ──────────────────────────────────────────────────────────────

interface SeedLine {
  lineType: InvoiceLineType;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

interface SeedPayment {
  amount: number;
  paidDate: Date;
  method?: string;
  reference?: string;
}

interface InvoiceSpec {
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  projectNumber: string;
  customerNumber?: string;
  subcontractorName?: string;
  periodFrom: Date;
  periodTo: Date;
  issueDate: Date;
  paymentTermDays?: number;
  isPartialInvoice?: boolean;
  partialNumber?: number;
  partialPercentage?: number;
  notes?: string;
  internalNotes?: string;
  lines: SeedLine[];
  payments?: SeedPayment[];
}

/** Kaufmännisch auf 2 Nachkommastellen runden. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// KW 24/2026: 08.06.–14.06., KW 25/2026: 15.06.–21.06.
const KW24_FROM = new Date('2026-06-08');
const KW25_FROM = new Date('2026-06-15');
const KW25_TO = new Date('2026-06-21');
const ISSUE = new Date('2026-06-22');

const INVOICE_SPECS: InvoiceSpec[] = [
  // ── Ausgangsrechnungen ─────────────────────────────────────
  {
    invoiceNumber: 'RE-2026-0001',
    invoiceType: InvoiceType.OUTGOING,
    status: InvoiceStatus.SENT,
    projectNumber: 'PRJ-2026-0001', // Videoüberwachung Hafenterminal
    customerNumber: 'K-2026-0001',
    periodFrom: KW24_FROM,
    periodTo: KW25_TO,
    issueDate: ISSUE,
    paymentTermDays: 14,
    notes: 'Vielen Dank für Ihren Auftrag.',
    lines: [
      {
        lineType: InvoiceLineType.WEEKLY_PACKAGE,
        description: 'Wochenpaket KW 24/2026',
        quantity: 1,
        unit: 'Pauschale',
        unitPrice: 3200,
      },
      {
        lineType: InvoiceLineType.WEEKLY_PACKAGE,
        description: 'Wochenpaket KW 25/2026',
        quantity: 1,
        unit: 'Pauschale',
        unitPrice: 3200,
      },
      {
        lineType: InvoiceLineType.OVERTIME,
        description: 'Überstunden KW 25/2026: 6 Std',
        quantity: 6,
        unit: 'Std',
        unitPrice: 65,
      },
    ],
  },
  {
    invoiceNumber: 'RE-2026-0002',
    invoiceType: InvoiceType.OUTGOING,
    status: InvoiceStatus.PAID,
    projectNumber: 'PRJ-2026-0002', // Elektroinstallation Neubau Süd
    customerNumber: 'K-2026-0002',
    periodFrom: KW25_FROM,
    periodTo: KW25_TO,
    issueDate: ISSUE,
    paymentTermDays: 30,
    notes: 'Einheitsbasierte Abrechnung gemäß Aufmaß.',
    lines: [
      {
        lineType: InvoiceLineType.UNIT_BASED,
        description: 'Verlegung NYM-J 3x1,5mm² Leitung',
        quantity: 850,
        unit: 'm',
        unitPrice: 4.2,
      },
      {
        lineType: InvoiceLineType.UNIT_BASED,
        description: 'Montage Schalter & Steckdosen',
        quantity: 120,
        unit: 'Stk',
        unitPrice: 18.5,
      },
      {
        lineType: InvoiceLineType.CUSTOM,
        description: 'An- und Abfahrt (Pauschale)',
        quantity: 1,
        unit: 'Pauschale',
        unitPrice: 250,
      },
    ],
    payments: [
      {
        amount: 7187.6,
        paidDate: new Date('2026-06-28'),
        method: 'Überweisung',
        reference: 'SEPA-2026-0628',
      },
    ],
  },
  {
    invoiceNumber: 'RE-2026-0003',
    invoiceType: InvoiceType.OUTGOING,
    status: InvoiceStatus.DRAFT,
    projectNumber: 'PRJ-2026-0001', // Hafenterminal – 1. Abschlag
    customerNumber: 'K-2026-0001',
    periodFrom: new Date('2026-07-06'),
    periodTo: new Date('2026-09-30'),
    issueDate: new Date('2026-07-01'),
    paymentTermDays: 14,
    isPartialInvoice: true,
    partialNumber: 1,
    partialPercentage: 30,
    notes: '1. Abschlagsrechnung (30% des Gesamtauftrags).',
    lines: [
      {
        lineType: InvoiceLineType.PARTIAL_PAYMENT,
        description: '1. Abschlagsrechnung (30% des Gesamtauftrags)',
        quantity: 1,
        unit: 'Pauschale',
        unitPrice: 12000,
      },
    ],
  },
  // ── Eingangsrechnungen ─────────────────────────────────────
  {
    invoiceNumber: 'ER-2026-0001',
    invoiceType: InvoiceType.INCOMING,
    status: InvoiceStatus.SENT,
    projectNumber: 'PRJ-2026-0001',
    subcontractorName: 'Elektro Kovačević d.o.o.',
    periodFrom: KW25_FROM,
    periodTo: KW25_TO,
    issueDate: ISSUE,
    paymentTermDays: 14,
    internalNotes: 'Leistungsnachweis über genehmigte Stundenzettel KW 25.',
    lines: [
      {
        lineType: InvoiceLineType.CUSTOM,
        description: 'Marko Kovačević, KW 25/2026: 38,5 Std × 42,00 €/Std',
        quantity: 38.5,
        unit: 'Std',
        unitPrice: 42,
      },
      {
        lineType: InvoiceLineType.CUSTOM,
        description: 'Ivan Horvat, KW 25/2026: 40 Std × 28,00 €/Std',
        quantity: 40,
        unit: 'Std',
        unitPrice: 28,
      },
    ],
  },
  {
    invoiceNumber: 'ER-2026-0002',
    invoiceType: InvoiceType.INCOMING,
    status: InvoiceStatus.PAID,
    projectNumber: 'PRJ-2026-0002',
    subcontractorName: 'Baltic Power Solutions',
    periodFrom: KW25_FROM,
    periodTo: KW25_TO,
    issueDate: ISSUE,
    paymentTermDays: 14,
    lines: [
      {
        lineType: InvoiceLineType.CUSTOM,
        description: 'Piotr Wiśniewski, KW 25/2026: 40 Std × 40,00 €/Std',
        quantity: 40,
        unit: 'Std',
        unitPrice: 40,
      },
      {
        lineType: InvoiceLineType.CUSTOM,
        description: 'Tomasz Kowalski, KW 25/2026: 40 Std × 26,00 €/Std',
        quantity: 40,
        unit: 'Std',
        unitPrice: 26,
      },
    ],
    payments: [
      {
        amount: 3141.6,
        paidDate: new Date('2026-06-29'),
        method: 'Überweisung',
        reference: 'SEPA-2026-0629',
      },
    ],
  },
];

async function seedInvoicesModule(): Promise<void> {
  const TAX_RATE = 19;

  for (const spec of INVOICE_SPECS) {
    const project = await prisma.project.findUnique({
      where: { projectNumber: spec.projectNumber },
    });
    if (!project) continue;

    let customerId: string | null = null;
    if (spec.customerNumber) {
      const customer = await prisma.customer.findUnique({
        where: { customerNumber: spec.customerNumber },
      });
      customerId = customer?.id ?? null;
    }

    let subcontractorId: string | null = null;
    if (spec.subcontractorName) {
      const sub = await prisma.subcontractor.findFirst({
        where: { name: spec.subcontractorName },
      });
      subcontractorId = sub?.id ?? null;
    }

    // Beträge aus den Positionen ableiten.
    const subtotal = round2(
      spec.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    );
    const taxAmount = round2((subtotal * TAX_RATE) / 100);
    const total = round2(subtotal + taxAmount);

    const paidAmount = spec.payments
      ? round2(spec.payments.reduce((sum, p) => sum + p.amount, 0))
      : null;

    const dueDate =
      spec.status === InvoiceStatus.DRAFT || spec.paymentTermDays == null
        ? null
        : new Date(
            spec.issueDate.getTime() +
              spec.paymentTermDays * 24 * 60 * 60 * 1000,
          );

    const paidDate =
      spec.status === InvoiceStatus.PAID && spec.payments?.length
        ? spec.payments[spec.payments.length - 1].paidDate
        : null;

    // Idempotent: bestehende Rechnung (inkl. Positionen/Zahlungen) entfernen.
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: spec.invoiceNumber },
    });
    if (existing) {
      await prisma.invoice.delete({ where: { id: existing.id } });
    }

    await prisma.invoice.create({
      data: {
        invoiceNumber: spec.invoiceNumber,
        invoiceType: spec.invoiceType,
        status: spec.status,
        projectId: project.id,
        customerId,
        subcontractorId,
        periodFrom: spec.periodFrom,
        periodTo: spec.periodTo,
        subtotal,
        taxRate: TAX_RATE,
        taxAmount,
        total,
        isPartialInvoice: spec.isPartialInvoice ?? false,
        partialNumber: spec.partialNumber ?? null,
        partialPercentage: spec.partialPercentage ?? null,
        paymentTermDays: spec.paymentTermDays ?? null,
        issueDate: spec.issueDate,
        dueDate,
        paidDate,
        paidAmount,
        notes: spec.notes ?? null,
        internalNotes: spec.internalNotes ?? null,
        lines: {
          create: spec.lines.map((l, index) => ({
            lineType: l.lineType,
            position: index,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit ?? null,
            unitPrice: l.unitPrice,
            total: round2(l.quantity * l.unitPrice),
          })),
        },
        payments: spec.payments
          ? {
              create: spec.payments.map((p) => ({
                amount: p.amount,
                paidDate: p.paidDate,
                method: p.method ?? null,
                reference: p.reference ?? null,
              })),
            }
          : undefined,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log('🌱 Seed startet …');

  // ── Rollen ───────────────────────────────────────────────────
  const roleByCode = new Map<RoleCode, string>();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description },
    });
    roleByCode.set(r.code, role.id);
  }
  console.log(`   ✓ ${ROLES.length} Rollen`);

  // ── Berechtigungen ───────────────────────────────────────────
  const permByCode = new Map<string, string>();
  for (const code of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    permByCode.set(code, perm.id);
  }
  console.log(`   ✓ ${PERMISSIONS.length} Berechtigungen`);

  // ── Rollen-Berechtigungen ────────────────────────────────────
  let rpCount = 0;
  for (const r of ROLES) {
    const roleId = roleByCode.get(r.code)!;
    const allows = ROLE_PERMISSIONS[r.code];
    for (const code of PERMISSIONS) {
      if (!allows(code)) continue;
      const permissionId = permByCode.get(code)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
      rpCount++;
    }
  }
  console.log(`   ✓ ${rpCount} Rollen-Berechtigungen`);

  // ── Benutzer ─────────────────────────────────────────────────
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { displayName: u.displayName, passwordHash, isActive: true },
      create: { email: u.email, displayName: u.displayName, passwordHash },
    });
    const roleId = roleByCode.get(u.role)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
  }
  console.log(`   ✓ ${USERS.length} Benutzer (admin@office.local / admin123 …)`);

  // ── Beispiel-Kunde + Niederlassung + Ansprechpartner ─────────
  const customer = await prisma.customer.upsert({
    where: { customerNumber: 'K-0001' },
    update: {},
    create: {
      customerNumber: 'K-0001',
      companyName: 'Mustermann GmbH',
      legalForm: 'GmbH',
      status: CustomerStatus.ACTIVE,
      phone: '+49 30 1234567',
      addressLine1: 'Musterstraße 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
    },
  });

  // Allgemeine E-Mail idempotent anlegen (ersetzt das frühere email-Feld)
  const existingMusterEmail = await prisma.customerEmail.findFirst({
    where: { customerId: customer.id, email: 'info@mustermann.example' },
  });
  if (!existingMusterEmail) {
    await prisma.customerEmail.create({
      data: {
        customerId: customer.id,
        email: 'info@mustermann.example',
        emailType: 'GENERAL',
        isPrimary: true,
      },
    });
  }

  let branch = await prisma.customerBranch.findFirst({
    where: { customerId: customer.id, name: 'Hauptsitz' },
  });
  if (!branch) {
    branch = await prisma.customerBranch.create({
      data: {
        customerId: customer.id,
        name: 'Hauptsitz',
        addressLine1: 'Musterstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        country: 'DE',
      },
    });
  }

  let contact = await prisma.customerContact.findFirst({
    where: { customerId: customer.id, lastName: 'Muster', firstName: 'Erika' },
  });
  if (!contact) {
    contact = await prisma.customerContact.create({
      data: {
        customerId: customer.id,
        branchId: branch.id,
        firstName: 'Erika',
        lastName: 'Muster',
        role: 'Einkauf',
        email: 'erika.muster@mustermann.example',
        phoneMobile: '+49 170 1234567',
        isProjectContact: true,
        isSignatory: true,
      },
    });
  }
  console.log('   ✓ Beispiel-Kunde "Mustermann GmbH" + Niederlassung + Kontakt');

  // ── Weitere Beispielkunden (additiv, idempotent) ─────────────
  await seedExampleCustomers();
  console.log('   ✓ 3 Beispielkunden (Bewertung A/B/C) mit Unter-Entities');

  // ── Beispiel-BreakRule (global) ──────────────────────────────
  let breakRule = await prisma.breakRule.findFirst({
    where: { scopeType: BreakScopeType.GLOBAL, name: 'Gesetzliche Pausen' },
  });
  if (!breakRule) {
    breakRule = await prisma.breakRule.create({
      data: {
        scopeType: BreakScopeType.GLOBAL,
        name: 'Gesetzliche Pausen',
        autoDeductEnabled: true,
        thresholdMinutes1: 360,
        breakMinutes1: 30,
        thresholdMinutes2: 540,
        breakMinutes2: 45,
      },
    });
  }
  console.log('   ✓ Beispiel-Pausenregel (ab 360min → 30min, ab 540min → 45min)');

  // ── Projektleiter-User für Projektzuordnung ──────────────────
  const pmUser = await prisma.user.findUnique({
    where: { email: 'pl@office.local' },
  });

  // ── Beispiel-Projekt ─────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { projectNumber: 'P-0001' },
    update: {},
    create: {
      projectNumber: 'P-0001',
      customerId: customer.id,
      branchId: branch.id,
      title: 'Videoüberwachung Hauptsitz',
      description: 'Installation einer Videoüberwachungsanlage am Hauptsitz.',
      serviceType: ServiceType.VIDEO,
      status: ProjectStatus.ACTIVE,
      priority: Priority.HIGH,
      siteName: 'Hauptsitz Berlin',
      siteAddressLine1: 'Musterstraße 1',
      sitePostalCode: '10115',
      siteCity: 'Berlin',
      siteCountry: 'DE',
      internalProjectManagerUserId: pmUser?.id,
      primaryCustomerContactId: contact.id,
      pauseRuleId: breakRule.id,
    },
  });
  console.log('   ✓ Beispiel-Projekt "Videoüberwachung Hauptsitz" (ACTIVE)');

  // ── Beispiel-Monteur + PIN ───────────────────────────────────
  const worker = await prisma.worker.upsert({
    where: { workerNumber: 'M-0001' },
    update: {},
    create: {
      workerNumber: 'M-0001',
      firstName: 'Max',
      lastName: 'Muster',
      languageCode: 'de',
      hasDriversLicense: true,
      active: true,
    },
  });

  const existingPin = await prisma.workerPin.findFirst({
    where: { workerId: worker.id, isActive: true },
  });
  if (!existingPin) {
    const pinHash = await bcrypt.hash('123456', SALT_ROUNDS);
    await prisma.workerPin.create({
      data: {
        workerId: worker.id,
        pinHash,
        validFrom: new Date(),
        isActive: true,
      },
    });
  }

  // Monteur dem Projekt zuordnen
  const assignment = await prisma.projectAssignment.findFirst({
    where: { projectId: project.id, workerId: worker.id },
  });
  if (!assignment) {
    await prisma.projectAssignment.create({
      data: {
        projectId: project.id,
        workerId: worker.id,
        roleName: 'Monteur',
        startDate: new Date(),
        active: true,
      },
    });
  }
  console.log('   ✓ Beispiel-Monteur "Max Muster" (PIN 123456) → Projekt zugeordnet');

  // ── Beispiel-Fahrzeug (Stammdaten; Zuweisungen via seedVehiclesModule) ─
  const bofInspection = new Date();
  bofInspection.setDate(bofInspection.getDate() + 220);
  const bofInsurance = new Date();
  bofInsurance.setDate(bofInsurance.getDate() + 310);
  const bofVehicleData = {
    make: 'VW',
    model: 'Transporter',
    internalName: 'Bus 1',
    ownerType: 'OWN',
    category: 'Transporter',
    year: 2021,
    color: 'Weiß',
    fuelType: 'Diesel',
    nextInspection: bofInspection,
    insuranceExpiry: bofInsurance,
    active: true,
  };
  await prisma.vehicle.upsert({
    where: { licensePlate: 'B-OF 1234' },
    update: bofVehicleData,
    create: { licensePlate: 'B-OF 1234', ...bofVehicleData },
  });
  console.log('   ✓ Beispiel-Fahrzeug "B-OF 1234" (VW Transporter)');

  // ── Beispiel-Ausrüstung ──────────────────────────────────────
  await prisma.equipmentItem.upsert({
    where: { itemNumber: 'E-0001' },
    update: {},
    create: {
      itemNumber: 'E-0001',
      category: EquipmentCategory.TOOL,
      name: 'Akkuschrauber',
      trackable: true,
      active: true,
    },
  });

  // ── Beispielprojekte (additiv, idempotent) ──────────────────
  await seedExampleProjects();
  console.log('   ✓ 4 Beispielprojekte (inkl. Standorte, Equipment, Zuordnungen, Status-Verlauf)');

  // ── Monteur-/Personalmodul (Subunternehmen, Monteure, Teams) ─
  await seedWorkersModule();
  console.log(
    '   ✓ Monteurmodul: 2 Subunternehmen, 6 Monteure, 2 Teams, Zuweisungen, Equipment-Ausgaben',
  );

  // ── Zeiterfassung (PINs, Stempelungen, Stundenzettel) ────────
  await seedTimesheetsModule();
  console.log(
    '   ✓ Zeiterfassung: PINs 001001–001006, Stempelungen (2 Wochen), Stundenzettel (Vorwoche APPROVED + aktuelle Woche DRAFT), Hafenterminal-Pausenregel',
  );

  // ── Abrechnung (Aus-/Eingangsrechnungen) ─────────────────────
  await seedInvoicesModule();
  console.log(
    '   ✓ Abrechnung: 3 Ausgangsrechnungen (SENT/PAID/DRAFT-Abschlag), 2 Eingangsrechnungen (SENT/PAID) mit Positionen + Zahlungen',
  );

  // ── Fahrzeugverwaltung (Fuhrpark + Zuweisungen) ──────────────
  await seedVehiclesModule();
  console.log(
    '   ✓ Fahrzeuge: 4 Fahrzeuge (eigene + Sub), Zuweisungen inkl. Historie (B-OF 1234: Ahmed→Stefan, D-EK 567: Marko), D-OF 4321 mit ablaufendem TÜV',
  );

  // ── Standard-Dokumentenordner für alle Entitäten ─────────────
  await seedDocumentFolders();
  console.log(
    '   ✓ Dokumentenordner: Standard-Ordner für Kunden, Projekte, Monteure und Fahrzeuge',
  );

  console.log('✅ Seed abgeschlossen.');
}

/**
 * Legt für jede bestehende Entität die fachlichen Standard-Ordner an.
 * Idempotent: ein Ordner wird nur erstellt, wenn er noch nicht existiert.
 */
async function seedDocumentFolders(): Promise<void> {
  const DEFAULT_FOLDERS: Record<string, string[]> = {
    CUSTOMER: ['Verträge', 'Korrespondenz', 'Logos'],
    PROJECT: ['Baustellenfotos', 'Pläne & Zeichnungen', 'Protokolle', 'Lieferscheine'],
    WORKER: ['Ausweise & Pässe', 'Zertifikate', 'Verträge'],
    VEHICLE: ['Fahrzeugschein', 'Versicherung', 'TÜV'],
  };

  const entities: { entityType: string; ids: string[] }[] = [
    {
      entityType: 'CUSTOMER',
      ids: (await prisma.customer.findMany({ select: { id: true } })).map(
        (e) => e.id,
      ),
    },
    {
      entityType: 'PROJECT',
      ids: (await prisma.project.findMany({ select: { id: true } })).map(
        (e) => e.id,
      ),
    },
    {
      entityType: 'WORKER',
      ids: (await prisma.worker.findMany({ select: { id: true } })).map(
        (e) => e.id,
      ),
    },
    {
      entityType: 'VEHICLE',
      ids: (await prisma.vehicle.findMany({ select: { id: true } })).map(
        (e) => e.id,
      ),
    },
  ];

  for (const { entityType, ids } of entities) {
    const names = DEFAULT_FOLDERS[entityType];
    for (const entityId of ids) {
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const existing = await prisma.documentFolder.findFirst({
          where: { entityType, entityId, name, parentId: null },
        });
        if (!existing) {
          await prisma.documentFolder.create({
            data: { entityType, entityId, name, sortOrder: i },
          });
        }
      }
    }
  }
}

/**
 * Fahrzeugmodul: 3 weitere Fahrzeuge (Sub + eigenes) sowie alle
 * Monteur-Zuweisungen inkl. Historie. Idempotent: bestehende Zuweisungen
 * der Seed-Fahrzeuge werden vor dem Anlegen entfernt.
 */
async function seedVehiclesModule(): Promise<void> {
  const daysFromNow = (days: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  // Referenzen auf bestehende Subunternehmen & Monteure
  const kovacevic = await prisma.subcontractor.findFirst({
    where: { name: 'Elektro Kovačević d.o.o.' },
  });
  const baltic = await prisma.subcontractor.findFirst({
    where: { name: 'Baltic Power Solutions' },
  });
  const stefan = await prisma.worker.findUnique({
    where: { workerNumber: 'W-2026-0005' }, // Stefan Müller
  });
  const marko = await prisma.worker.findUnique({
    where: { workerNumber: 'W-2026-0001' }, // Marko Kovačević
  });
  const ahmed = await prisma.worker.findUnique({
    where: { workerNumber: 'W-2026-0006' }, // Ahmed
  });

  // ── Fahrzeuge 2–4 (B-OF 1234 wird bereits in main() upserted) ──
  const sprinter = await prisma.vehicle.upsert({
    where: { licensePlate: 'D-EK 567' },
    update: {
      make: 'Mercedes',
      model: 'Sprinter',
      internalName: 'Sub-Bus Kovačević',
      ownerType: 'SUBCONTRACTOR',
      subcontractorId: kovacevic?.id ?? null,
      category: 'Transporter',
      year: 2020,
      color: 'Silber',
      fuelType: 'Diesel',
      nextInspection: daysFromNow(180),
      insuranceExpiry: daysFromNow(240),
      active: true,
    },
    create: {
      licensePlate: 'D-EK 567',
      make: 'Mercedes',
      model: 'Sprinter',
      internalName: 'Sub-Bus Kovačević',
      ownerType: 'SUBCONTRACTOR',
      subcontractorId: kovacevic?.id ?? null,
      category: 'Transporter',
      year: 2020,
      color: 'Silber',
      fuelType: 'Diesel',
      nextInspection: daysFromNow(180),
      insuranceExpiry: daysFromNow(240),
      active: true,
    },
  });

  await prisma.vehicle.upsert({
    where: { licensePlate: 'GD-BP 89' },
    update: {
      make: 'Fiat',
      model: 'Ducato',
      internalName: 'Sub-Bus Baltic',
      ownerType: 'SUBCONTRACTOR',
      subcontractorId: baltic?.id ?? null,
      category: 'Transporter',
      year: 2019,
      color: 'Weiß',
      fuelType: 'Diesel',
      nextInspection: daysFromNow(150),
      insuranceExpiry: daysFromNow(120),
      active: true,
    },
    create: {
      licensePlate: 'GD-BP 89',
      make: 'Fiat',
      model: 'Ducato',
      internalName: 'Sub-Bus Baltic',
      ownerType: 'SUBCONTRACTOR',
      subcontractorId: baltic?.id ?? null,
      category: 'Transporter',
      year: 2019,
      color: 'Weiß',
      fuelType: 'Diesel',
      nextInspection: daysFromNow(150),
      insuranceExpiry: daysFromNow(120),
      active: true,
    },
  });

  const caddy = await prisma.vehicle.upsert({
    where: { licensePlate: 'D-OF 4321' },
    update: {
      make: 'VW',
      model: 'Caddy',
      internalName: 'PKW 1',
      ownerType: 'OWN',
      category: 'PKW',
      year: 2018,
      color: 'Blau',
      fuelType: 'Benzin',
      nextInspection: daysFromNow(15), // TÜV läuft bald ab → Warnung
      insuranceExpiry: daysFromNow(200),
      active: true,
    },
    create: {
      licensePlate: 'D-OF 4321',
      make: 'VW',
      model: 'Caddy',
      internalName: 'PKW 1',
      ownerType: 'OWN',
      category: 'PKW',
      year: 2018,
      color: 'Blau',
      fuelType: 'Benzin',
      nextInspection: daysFromNow(15),
      insuranceExpiry: daysFromNow(200),
      active: true,
    },
  });

  // ── Zuweisungen + Historie (idempotent neu aufbauen) ──────────
  const bof = await prisma.vehicle.findUnique({
    where: { licensePlate: 'B-OF 1234' },
  });

  // Bestehende Zuweisungen der Seed-Fahrzeuge entfernen
  const seedVehicleIds = [bof?.id, sprinter.id, caddy.id].filter(
    (id): id is string => Boolean(id),
  );
  await prisma.workerVehicleAssignment.deleteMany({
    where: { vehicleId: { in: seedVehicleIds } },
  });

  // B-OF 1234: vorher Ahmed (beendet), jetzt Stefan
  if (bof && ahmed) {
    await prisma.workerVehicleAssignment.create({
      data: {
        vehicleId: bof.id,
        workerId: ahmed.id,
        assignedFrom: daysFromNow(-90),
        assignedTo: daysFromNow(-30),
        notes: 'Frühere Zuweisung',
      },
    });
  }
  if (bof && stefan) {
    await prisma.workerVehicleAssignment.create({
      data: {
        vehicleId: bof.id,
        workerId: stefan.id,
        assignedFrom: daysFromNow(-30),
        assignedTo: null,
        notes: 'Aktueller Fahrer',
      },
    });
  }

  // D-EK 567: seit Projektstart an Marko
  if (marko) {
    await prisma.workerVehicleAssignment.create({
      data: {
        vehicleId: sprinter.id,
        workerId: marko.id,
        assignedFrom: daysFromNow(-60),
        assignedTo: null,
        notes: 'Seit Projektstart',
      },
    });
  }

  // GD-BP 89 + D-OF 4321 bleiben unzugewiesen (verfügbar)
}

main()
  .catch((e) => {
    console.error('❌ Seed fehlgeschlagen:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
