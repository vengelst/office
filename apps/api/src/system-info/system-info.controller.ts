import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemInfoService } from './system-info.service';

@ApiTags('system-info')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SUPERADMIN')
@Controller('system-info')
export class SystemInfoController {
  constructor(private readonly systemInfo: SystemInfoService) {}

  @Get()
  @ApiOperation({ summary: 'System-Info und Metriken abrufen' })
  getSystemInfo() {
    return this.systemInfo.getSystemInfo();
  }

  @Post('update-packages')
  @ApiOperation({ summary: 'Container-Pakete aktualisieren' })
  updatePackages() {
    return this.systemInfo.updatePackages();
  }
}
