import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard für öffentliche Endpoints, die über einen API-Key geschützt werden.
 * Prüft den Header `x-api-key` gegen KIOSK_API_KEY aus der Umgebung.
 * In Produktion: Zugriff wird verweigert wenn kein Key konfiguriert ist (fail-closed).
 * In Entwicklung: Zugriff ohne Key erlaubt (Rückwärtskompatibilität).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.config.get<string>('KIOSK_API_KEY');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (!expectedKey) {
      if (isProduction) {
        this.logger.warn('KIOSK_API_KEY nicht gesetzt – Zugriff verweigert');
        throw new UnauthorizedException(
          'Kiosk-API-Key nicht konfiguriert',
        );
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const providedKey = req.headers['x-api-key'];

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Ungültiger API-Key');
    }

    return true;
  }
}
