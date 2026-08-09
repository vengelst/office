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
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Alle Benutzer auflisten (nur SUPERADMIN)' })
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Benutzer abrufen' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateUserDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Benutzer anlegen (nur SUPERADMIN)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateUserDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Benutzer bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Benutzer deaktivieren' })
  remove(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  /**
   * Setzt oder aktualisiert die PIN eines Benutzers.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param body - Parameter `body` ({ pin: string })
   * @returns Ergebnis
   */

  @Put(':id/pin')
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
  @ApiOperation({ summary: 'PIN für Kunden-PL setzen (6 Ziffern, global eindeutig)' })
  setPin(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.usersService.setPin(id, body.pin);
  }
}
