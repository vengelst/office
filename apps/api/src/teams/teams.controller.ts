/**
 * HTTP-API für Teams.
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('teams')
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Alle Teams mit Mitglieder-Anzahl' })
  findAll() {
    return this.teams.findAll();
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Team-Detail mit Mitgliederliste' })
  findOne(@Param('id') id: string) {
    return this.teams.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateTeamDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Team erstellen' })
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateTeamDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Team bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Team löschen' })
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }

  // ── Mitglieder ───────────────────────────────────────────────

  /**
   * Fügt ein Teammitglied hinzu.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (CreateTeamMemberDto)
   * @returns Mitgliedschaft
   */

  @Post(':id/members')
  @ApiOperation({ summary: 'Mitglied hinzufügen' })
  addMember(@Param('id') id: string, @Body() dto: CreateTeamMemberDto) {
    return this.teams.addMember(id, dto);
  }

  /**
   * Entfernt ein Teammitglied.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param memberId - ID (memberId) (string)
   * @returns Ergebnis
   */

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Mitglied entfernen (leftAt setzen)' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teams.removeMember(id, memberId);
  }
}
