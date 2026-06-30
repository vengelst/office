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
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Teams mit Mitglieder-Anzahl' })
  findAll() {
    return this.teams.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Team-Detail mit Mitgliederliste' })
  findOne(@Param('id') id: string) {
    return this.teams.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Team erstellen' })
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Team bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Team löschen' })
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }

  // ── Mitglieder ───────────────────────────────────────────────

  @Post(':id/members')
  @ApiOperation({ summary: 'Mitglied hinzufügen' })
  addMember(@Param('id') id: string, @Body() dto: CreateTeamMemberDto) {
    return this.teams.addMember(id, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Mitglied entfernen (leftAt setzen)' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teams.removeMember(id, memberId);
  }
}
