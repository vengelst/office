/**
 * DTOs für KI-Assistent-Einstellungen und Import.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AiSettingsUpdateDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 'https://api.openai.com/v1' })
  @IsString()
  baseUrl!: string;

  @ApiProperty({ example: 'gpt-4.1-mini' })
  @IsString()
  model!: string;

  @ApiPropertyOptional({
    description: 'Leer lassen = vorhandenen Key behalten',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ example: 120000 })
  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(600000)
  timeoutMs?: number;
}

export class AiImportBranchDto {
  @IsBoolean()
  include!: boolean;

  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  branchType?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mapsUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsIn(['FOUND', 'PARTIAL', 'NOT_FOUND', 'SKIPPED'])
  enrichmentStatus!: 'FOUND' | 'PARTIAL' | 'NOT_FOUND' | 'SKIPPED';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceUrls?: string[];
}

export class AiImportContactDto {
  @IsBoolean()
  include!: boolean;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phoneLandline?: string;

  @IsOptional()
  @IsString()
  phoneMobile?: string;

  @IsOptional()
  @IsString()
  linkedInUrl?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  branchKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  priority?: 'A' | 'B' | 'C';

  @IsOptional()
  @IsIn(['PERSON', 'COMPANY_EMAIL'])
  kind?: 'PERSON' | 'COMPANY_EMAIL';
}

export class AiImportCompanyEmailDto {
  @IsBoolean()
  include!: boolean;

  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  emailType?: string;
}

export class AiImportCustomerDraftDto {
  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  rating?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AiImportCommitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previewId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ONE_CUSTOMER_MANY_CONTACTS', 'ONE_ROW_ONE_CUSTOMER'])
  mode?: 'ONE_CUSTOMER_MANY_CONTACTS' | 'ONE_ROW_ONE_CUSTOMER';

  @ApiPropertyOptional({
    description: 'Bestehenden Kunden verwenden statt neu anlegen',
  })
  @IsOptional()
  @IsString()
  attachToCustomerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceFilename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ONE_CUSTOMER_MANY_CONTACTS', 'ONE_ROW_ONE_CUSTOMER'])
  suggestedMode?: 'ONE_CUSTOMER_MANY_CONTACTS' | 'ONE_ROW_ONE_CUSTOMER';

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AiImportCustomerDraftDto)
  customerDraft?: AiImportCustomerDraftDto;

  @ApiProperty({ type: [AiImportBranchDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiImportBranchDto)
  branches!: AiImportBranchDto[];

  @ApiProperty({ type: [AiImportContactDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiImportContactDto)
  contacts!: AiImportContactDto[];

  @ApiPropertyOptional({ type: [AiImportCompanyEmailDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiImportCompanyEmailDto)
  companyEmails?: AiImportCompanyEmailDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];
}
