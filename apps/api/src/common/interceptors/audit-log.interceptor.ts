import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthUser } from '@office/types';
import { PrismaService } from '../../prisma/prisma.service';

/** HTTP-Methoden, die einen Audit-Eintrag erzeugen. */
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Schreibt für verändernde Requests einen AuditLog-Eintrag.
 * Bewusst minimal-invasiv: Fehler beim Logging brechen die Anfrage nicht ab.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    const user = request.user;

    return next.handle().pipe(
      tap((result: unknown) => {
        const entityId =
          (result as { id?: string } | undefined)?.id ??
          (request.params?.id as string | undefined) ??
          '';

        void this.prisma.auditLog
          .create({
            data: {
              actorUserId: user?.type === 'user' ? user.id : null,
              actorType: user?.type ?? 'anonymous',
              entityType: this.deriveEntityType(request.path),
              entityId,
              action: request.method,
              afterJson: this.safeJson(result),
            },
          })
          .catch(() => undefined);
      }),
    );
  }

  private deriveEntityType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    // Format: /api/<entity>/...
    return segments[1] ?? segments[0] ?? 'unknown';
  }

  private safeJson(value: unknown): object | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(value)) as object;
    } catch {
      return undefined;
    }
  }
}
