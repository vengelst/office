/**
 * HTTP-API für Rollen und Permissions (Benutzerverwaltung).
 */

import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesService } from './roles.service';

class SetRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermission('users.manage')
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Rollen mit Permissions auflisten' })
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Alle Permission-Codes auflisten' })
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Put('roles/:code/permissions')
  @ApiOperation({ summary: 'Permissions einer Rolle setzen (ersetzen)' })
  setPermissions(
    @Param('code') code: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setRolePermissions(code, dto.permissions);
  }
}
