/** Bekannte Restore-/Backup-Module (selektiver Restore). */
export const BACKUP_MODULES = [
  'todos',
  'customers',
  'projects',
  'workers',
  'teams',
  'subcontractors',
  'vehicles',
  'equipment',
  'timesheets',
  'documents',
  'invoices',
] as const;

export type BackupModule = (typeof BACKUP_MODULES)[number];

export function isBackupModule(value: string): value is BackupModule {
  return (BACKUP_MODULES as readonly string[]).includes(value);
}
