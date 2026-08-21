/**
 * Controller für Feature-Flags (GET alle Auth-User, PUT nur SUPERADMIN).
 */

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { RoleCode } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import type { FeatureFlags } from './feature-flags.constants';

export class UpdateFeatureFlagsDto {
  @IsOptional() @IsBoolean() customers?: boolean;
  @IsOptional() @IsBoolean() projects?: boolean;
  @IsOptional() @IsBoolean() workers?: boolean;
  @IsOptional() @IsBoolean() teams?: boolean;
  @IsOptional() @IsBoolean() subcontractors?: boolean;
  @IsOptional() @IsBoolean() vehicles?: boolean;
  @IsOptional() @IsBoolean() equipment?: boolean;
  @IsOptional() @IsBoolean() timeClock?: boolean;
  @IsOptional() @IsBoolean() timesheets?: boolean;
  @IsOptional() @IsBoolean() documents?: boolean;
  @IsOptional() @IsBoolean() invoices?: boolean;
  @IsOptional() @IsBoolean() todos?: boolean;
  @IsOptional() @IsBoolean() calendar?: boolean;
}

@ApiTags('feature-flags')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get()
  @Roles(
    RoleCode.SUPERADMIN,
    RoleCode.OFFICE,
    RoleCode.PROJECT_MANAGER,
    RoleCode.CUSTOMER_PL,
  )
  @ApiOperation({ summary: 'Feature-Flags abrufen (Defaults true)' })
  async get(): Promise<FeatureFlags> {
    return this.featureFlags.getFlags();
  }

  @Put()
  @Roles(RoleCode.SUPERADMIN)
  @ApiOperation({ summary: 'Feature-Flags speichern (nur SUPERADMIN)' })
  async put(@Body() dto: UpdateFeatureFlagsDto): Promise<FeatureFlags> {
    return this.featureFlags.setFlags(dto);
  }
}
