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
      email: 'info@mustermann.example',
      phone: '+49 30 1234567',
      addressLine1: 'Musterstraße 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
    },
  });

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
