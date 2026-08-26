'use client';

interface PlAutoLogoutBannerProps {
  countdown: number;
  message: (seconds: number) => string;
}

export function PlAutoLogoutBanner({ countdown, message }: PlAutoLogoutBannerProps) {
  if (countdown <= 0 || countdown > 30) return null;

  return (
    <div className="fixed bottom-2 left-0 right-0 text-center text-xs text-gray-500">
      {message(countdown)}
    </div>
  );
}
