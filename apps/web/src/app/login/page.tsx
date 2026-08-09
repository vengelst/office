'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { homeRouteFor } from '@/lib/roles';
import { texts } from '@/lib/texts';
import { AppBrand } from '@/components/layout/app-brand';

export default function LoginPage(): React.ReactNode {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bereits angemeldet → Startseite je nach Rolle (Kunden-PL: /pl).
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(homeRouteFor(user));
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      router.replace(homeRouteFor(loggedIn));
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : texts.login.errorGeneric;
      toast({
        variant: 'destructive',
        title: texts.login.errorTitle,
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex justify-center">
            <AppBrand size="lg" showTagline={false} />
          </div>
          <CardTitle className="text-2xl">{texts.login.title}</CardTitle>
          <CardDescription>{texts.login.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{texts.login.email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder={texts.login.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{texts.login.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder={texts.login.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? texts.login.submitting : texts.login.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
