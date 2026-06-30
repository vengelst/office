import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BreakRulesService } from './break-rules.service';
import { CreateBreakRuleDto } from './dto/create-break-rule.dto';
import { UpdateBreakRuleDto } from './dto/update-break-rule.dto';

@ApiTags('break-rules')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('break-rules')
export class BreakRulesController {
  constructor(private readonly breakRules: BreakRulesService) {}

  @Get()
  @ApiOperation({ summary: 'Pausenregeln (global + projektspezifisch)' })
  findAll(@Query('projectId') projectId?: string) {
    return this.breakRules.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne Pausenregel' })
  findOne(@Param('id') id: string) {
    return this.breakRules.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Pausenregel erstellen' })
  create(@Body() dto: CreateBreakRuleDto) {
    return this.breakRules.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pausenregel bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateBreakRuleDto) {
    return this.breakRules.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Pausenregel löschen' })
  remove(@Param('id') id: string) {
    return this.breakRules.remove(id);
  }
}
