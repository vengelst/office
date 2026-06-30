import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '@office/types';

/**
 * Guard für Worker-Only-Endpoints (Monteur-App).
 * Validiert das Bearer-Token via JWT-Strategie und stellt zusätzlich sicher,
 * dass es sich um ein Worker-Token (type: 'worker') handelt.
 *
 * Routen mit diesem Guard sollten mit @Public() vom globalen JwtAuthGuard
 * ausgenommen werden, damit ausschließlich diese Prüfung greift.
 */
@Injectable()
export class WorkerAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser>(err: unknown, user: AuthUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Worker-Authentifizierung erforderlich');
    }
    if (user.type !== 'worker') {
      throw new UnauthorizedException('Kein gültiges Monteur-Token');
    }
    return user as TUser;
  }
}
