-- Prisma-Schema kennt ARCHIVED seit längerem; Prod-Enum fehlte → Stempel-Sperre (P2) crashte Clock-In.
ALTER TYPE "WeeklyTimesheetStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
