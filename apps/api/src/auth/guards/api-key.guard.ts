import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard für öffentliche Endpoints, die über einen API-Key geschützt werden.
 * Prüft den Header `x-api-key` gegen KIOSK_API_KEY aus der Umgebung.
 * Ist kein KIOSK_API_KEY konfiguriert, wird der Zugriff ohne Key erlaubt
 * (Rückwärtskompatibilität).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.config.get<string>('KIOSK_API_KEY');
    if (!expectedKey) {
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
