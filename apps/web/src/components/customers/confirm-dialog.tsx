'use client';

import { type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { texts } from '@/lib/texts';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** 'destructive' = roter Button (Standard), 'warning' = gelber Button (rückgängig machbar). */
  variant?: 'destructive' | 'warning';
  onConfirm: () => void;
}

const variantClasses: Record<string, string> = {
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  warning:
    'bg-amber-500 text-white hover:bg-amber-600',
};

/** Wiederverwendbarer Bestätigungsdialog für destruktive Aktionen. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = 'destructive',
  onConfirm,
}: ConfirmDialogProps): ReactNode {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{texts.customers.actions.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variantClasses[variant]}
          >
            {confirmLabel ?? texts.customers.actions.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
