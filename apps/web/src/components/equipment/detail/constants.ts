export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export const statusColor: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IN_REPAIR: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  RETIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};
