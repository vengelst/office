import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Kombiniert Klassennamen (clsx) und löst Tailwind-Konflikte auf (twMerge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
