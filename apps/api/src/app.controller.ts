import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health-Check' })
  health(): HealthStatus {
    return {
      status: 'ok',
      service: 'office-api',
      timestamp: new Date().toISOString(),
    };
  }
}
