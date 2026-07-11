import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, LoginResponse } from '@office/types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login mit E-Mail und Passwort' })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login mit Monteur-PIN' })
  pinLogin(@Body() dto: PinLoginDto): Promise<LoginResponse> {
    return this.authService.pinLogin(dto.pin);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Session invalidieren' })
  logout(
    @Headers('authorization') authHeader?: string,
  ): Promise<{ success: true }> {
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
    return this.authService.logout(token);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Token erneuern' })
  refresh(@CurrentUser() user: AuthUser): Promise<LoginResponse> {
    return this.authService.refresh(user);
  }
}
