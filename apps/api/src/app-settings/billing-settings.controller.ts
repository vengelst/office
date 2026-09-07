/**
 * HTTP-API für Verrechnung-Settings (Nummernkreise, Zahlungsziele, Skonto, Leistungsort).
 */

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingSettingsService } from './billing-settings.service';

class SeriesPatchDto {
  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  nextNumber?: number;
}

class SeriesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SeriesPatchDto)
  re?: SeriesPatchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeriesPatchDto)
  st?: SeriesPatchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeriesPatchDto)
  ko?: SeriesPatchDto;
}

class SkontoDto {
  @IsOptional()
  @IsNumber()
  percent?: number | null;

  @IsOptional()
  @IsInt()
  days?: number | null;

  @IsOptional()
  @IsString()
  pdfHintTemplate?: string | null;
}

class PerformanceCountryDto {
  @IsString()
  countryCode!: string;

  @IsString()
  name!: string;

  @IsNumber()
  standardRate!: number;

  @IsNumber()
  reducedRate!: number;
}

class BillingSettingsBodyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultPaymentTermDays?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  paymentTermOptions?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SkontoDto)
  skonto?: SkontoDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerformanceCountryDto)
  performanceCountries?: PerformanceCountryDto[];
}

class UpdateBillingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SeriesDto)
  series?: SeriesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingSettingsBodyDto)
  settings?: BillingSettingsBodyDto;
}

@ApiTags('billing-settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('settings/billing')
export class BillingSettingsController {
  constructor(private readonly billing: BillingSettingsService) {}

  @Get()
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Verrechnung-Settings inkl. Nummernkreise' })
  get() {
    return this.billing.get();
  }

  @Put()
  @Roles(RoleCode.SUPERADMIN)
  @ApiOperation({ summary: 'Verrechnung-Settings speichern (nur SUPERADMIN)' })
  update(@Body() dto: UpdateBillingDto) {
    return this.billing.update({
      series: dto.series,
      settings: dto.settings as Parameters<BillingSettingsService['update']>[0]['settings'],
    });
  }
}
