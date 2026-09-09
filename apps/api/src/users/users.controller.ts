/**
 * HTTP-API für Users und Rollenrechte.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('meta/roles')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Rollen inkl. Permissions' })
  listRoles() {
    return this.usersService.listRoles();
  }

  @Get('meta/permissions')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Alle Permission-Codes' })
  listPermissions() {
    return this.usersService.listPermissions();
  }

  @Put('meta/roles/:code/permissions')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Permission-Matrix einer Rolle setzen' })
  setRolePermissions(
    @Param('code', new ParseEnumPipe(RoleCode)) code: RoleCode,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.usersService.setRolePermissions(code, dto.permissions);
  }

  @Get()
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Alle Benutzer auflisten' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Einzelnen Benutzer abrufen' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Benutzer anlegen' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Benutzer bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Benutzer deaktivieren' })
  remove(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Put(':id/pin')
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({
    summary: 'PIN für Kunden-PL setzen (Länge laut Einstellung, global eindeutig)',
  })
  setPin(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.usersService.setPin(id, body.pin);
  }
}
