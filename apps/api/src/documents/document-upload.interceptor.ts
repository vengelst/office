/**
 * Multer-Interceptor mit konfigurierbarem fileSize (AppSetting document_upload_max_mb).
 */

import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
  mixin,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import multer from 'multer';
import { documentUploadTooLargeMessage } from '../app-settings/document-upload-limit';
import { DocumentsService } from './documents.service';

/**
 * Dynamisches Upload-Limit: liest AppSetting zur Request-Zeit und setzt Multer limits.fileSize.
 *
 * @param fieldName - Form-Feldname (`file` / `files`)
 * @param maxCount - wenn gesetzt: array-Upload mit max. Anzahl Dateien
 */
export function DocumentUploadInterceptor(
  fieldName: string,
  maxCount?: number,
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    constructor(private readonly documents: DocumentsService) {}

    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      const maxMb = await this.documents.resolveMaxUploadMb();
      const maxBytes = this.documents.maxUploadBytesFromMb(maxMb);
      const http = context.switchToHttp();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = http.getRequest<any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = http.getResponse<any>();

      const uploader = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxBytes },
      });
      const handler =
        maxCount != null
          ? uploader.array(fieldName, maxCount)
          : uploader.single(fieldName);

      await new Promise<void>((resolve, reject) => {
        handler(req, res, (err: unknown) => {
          if (!err) {
            resolve();
            return;
          }
          if (
            err instanceof multer.MulterError &&
            err.code === 'LIMIT_FILE_SIZE'
          ) {
            reject(
              new BadRequestException(documentUploadTooLargeMessage(maxMb)),
            );
            return;
          }
          reject(err);
        });
      });

      return next.handle();
    }
  }

  return mixin(MixinInterceptor);
}
