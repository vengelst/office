/**
 * HTTP-API für Users.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard, PermissionsGuard)
@RequirePermission('users.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Benutzer auflisten' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Benutzer abrufen' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Benutzer anlegen' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Benutzer bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Benutzer deaktivieren' })
  remove(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Put(':id/pin')
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'PIN für Kunden-PL setzen (global eindeutig)' })
  setPin(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.usersService.setPin(id, body.pin);
  }
}
