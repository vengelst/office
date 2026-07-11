import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard-Kennzahlen (Kunden, Projekte, Monteure, Stunden)' })
  getStats() {
    return this.dashboard.getStats();
  }
}
