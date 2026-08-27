/**
 * HTTP-API für KI-Kontakt-/Interessenten-Import (Preview + Commit).
 */

import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiImportService } from './ai-import.service';
import { AiImportCommitDto } from './dto/ai-import.dto';
import type {
  AiImportCommitResponse,
  AiImportPreviewResponse,
  ImportMode,
} from './types';

const MAX_FILE_SIZE = 12 * 1024 * 1024;

@ApiTags('ai-import')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('ai-import')
export class AiImportController {
  constructor(private readonly importer: AiImportService) {}

  @Post('contacts/preview')
  @ApiOperation({
    summary: 'Kontaktliste per KI analysieren (Preview, keine DB-Writes)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        hint: { type: 'string' },
        mode: {
          type: 'string',
          enum: ['ONE_CUSTOMER_MANY_CONTACTS', 'ONE_ROW_ONE_CUSTOMER'],
        },
        enrichBranches: { type: 'string', example: 'true' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('hint') hint?: string,
    @Body('mode') mode?: string,
    @Body('enrichBranches') enrichBranches?: string,
  ): Promise<AiImportPreviewResponse> {
    if (!file) {
      throw new BadRequestException('Multipart-Feld "file" fehlt');
    }
    const enrich =
      enrichBranches === undefined ||
      enrichBranches === '' ||
      enrichBranches === 'true' ||
      enrichBranches === '1';

    const modeValue: ImportMode | undefined =
      mode === 'ONE_ROW_ONE_CUSTOMER' ||
      mode === 'ONE_CUSTOMER_MANY_CONTACTS'
        ? mode
        : undefined;

    return this.importer.preview({
      file,
      hint,
      mode: modeValue,
      enrichBranches: enrich,
    });
  }

  @Post('contacts/commit')
  @ApiOperation({
    summary: 'Freigegebene KI-Import-Vorschau in die DB schreiben',
  })
  async commit(
    @Body() dto: AiImportCommitDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AiImportCommitResponse> {
    return this.importer.commit(dto, user.id);
  }
}
