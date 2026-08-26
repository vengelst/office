import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  label: string;
  onLogout: () => void;
}

export function LogoutButton({ label, onLogout }: LogoutButtonProps) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className="mt-auto flex min-h-[48px] items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      {label}
    </button>
  );
}
