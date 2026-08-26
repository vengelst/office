import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import { FeatureFlagsProvider } from '@/lib/feature-flags-context';
import { Toaster } from '@/components/ui/toaster';
import { texts } from '@/lib/texts';
import './globals.css';

export const metadata: Metadata = {
  title: texts.app.name,
  description: texts.app.tagline,
  applicationName: texts.app.name,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  appleWebApp: {
    capable: true,
    title: texts.app.name,
    statusBarStyle: 'default',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <FeatureFlagsProvider>
              {children}
              <Toaster />
            </FeatureFlagsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
