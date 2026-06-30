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
  PrismaClient,
  Priority,
  ProjectStatus,
  RoleCode,
  ServiceType,
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

  // ── Beispiel-Fahrzeug ────────────────────────────────────────
  await prisma.vehicle.upsert({
    where: { licensePlate: 'B-OF 1234' },
    update: {},
    create: {
      licensePlate: 'B-OF 1234',
      make: 'VW',
      model: 'Transporter',
      internalName: 'Bus 1',
      active: true,
    },
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

  console.log('✅ Seed abgeschlossen.');
}

main()
  .catch((e) => {
    console.error('❌ Seed fehlgeschlagen:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
