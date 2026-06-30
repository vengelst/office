import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkerAvailability, WorkerType } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateWorkerDto {
  // ── Persönlich ───────────────────────────────────────────────
  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional({ enum: WorkerType })
  @IsOptional()
  @IsEnum(WorkerType)
  workerType?: WorkerType;

  @ApiPropertyOptional({ enum: WorkerAvailability })
  @IsOptional()
  @IsEnum(WorkerAvailability)
  availability?: WorkerAvailability;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  // ── Kontakt ──────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneSecondary?: string;

  // ── Adresse ──────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  // ── Notfallkontakt ───────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  // ── Ausweise & Reisedokumente ────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialSecurityNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oib?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  passportExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residencePermitNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  residencePermitExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workPermitNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  workPermitExpiry?: string;

  // ── Vertrag & Kosten ─────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcontractorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  contractStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  contractEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dailyRate?: number;

  // ── PSA-Größen ───────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shoeSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clothingSize?: string;

  // ── Sonstiges ────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasDriversLicense?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
