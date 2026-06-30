import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, LoginResponse } from '@office/types';
import { AuthService } from '../auth/auth.service';
import { PinLoginDto } from '../auth/dto/pin-login.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkerAuthGuard } from '../auth/guards/worker-auth.guard';
import { WorkerAuthService } from './worker-auth.service';

@ApiTags('worker-auth')
@Controller('worker-auth')
export class WorkerAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly workerAuth: WorkerAuthService,
  ) {}

  @Public()
  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Monteur-Login per PIN → Worker-Token' })
  pinLogin(@Body() dto: PinLoginDto): Promise<LoginResponse> {
    return this.auth.pinLogin(dto.pin);
  }

  @Public()
  @UseGuards(WorkerAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Aktueller Monteur (aus Worker-Token)' })
  me(@CurrentUser() user: AuthUser) {
    return this.workerAuth.me(user.id);
  }

  @Public()
  @UseGuards(WorkerAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Worker-Token invalidieren (clientseitig)' })
  logout(): { success: true } {
    // Worker-Tokens werden nicht als Session persistiert – Logout erfolgt
    // clientseitig durch Verwerfen des Tokens.
    return { success: true };
  }
}
