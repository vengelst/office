import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RoleCode } from '@prisma/client';
import { IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ResearchService } from './research.service';
import type { ResearchResult } from './research.types';

class ResearchCompanyDto {
  @IsUrl({}, { message: 'Bitte eine gültige URL eingeben' })
  url!: string;

  @IsOptional()
  @IsBoolean()
  includeSocialMedia?: boolean;
}

/**
 * Controller für die Firmenrecherche.
 * Proxy zum Research-Microservice mit JWT-Auth und Rate-Limiting.
 */
@ApiTags('research')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('research')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  /**
   * Recherchiert Firmendaten anhand einer Website-URL.
   * POST /api/research/company
   *
   * @param dto - URL und optionale Einstellungen
   * @returns Strukturiertes Recherche-Ergebnis (Firma, Kontakte, Social Media)
   */
  @Post('company')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Firmenrecherche via Website-URL' })
  async researchCompany(@Body() dto: ResearchCompanyDto): Promise<ResearchResult> {
    try {
      return await this.research.researchCompany(
        dto.url,
        dto.includeSocialMedia ?? true,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Research-Service nicht verfügbar';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
