import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ProjectStatus, ServiceType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const BILLING_MODES = ['HOURLY_PACKAGE', 'UNIT_BASED', 'MIXED'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export class CreateProjectDto {
  @ApiProperty({ example: 'Videoüberwachung Hauptsitz' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  // ── Hauptstandort (Baustelle) ────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteAddressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sitePostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mapsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteAccessInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteWorkingHours?: string;

  // ── Abrechnung ───────────────────────────────────────────────
  @ApiPropertyOptional({ enum: BILLING_MODES })
  @IsOptional()
  @IsEnum(BILLING_MODES)
  billingMode?: BillingMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weeklyPackageHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weeklyPackagePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  overtimeRatePerHour?: number;

  // ── Unterkunft ───────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationAddressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationAddressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accommodationLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accommodationLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationMapsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationNotes?: string;

  // ── Zeitplan ─────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  plannedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  actualStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  actualEndDate?: string;

  // ── Zuständigkeiten / Sonstiges ──────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalProjectManagerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryCustomerContactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pauseRuleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
