import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';

export class CompanyInfoDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() legalForm?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() fax?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() vatId?: string;
  @IsOptional() @IsString() registerCourt?: string;
  @IsOptional() @IsString() registerNumber?: string;
  @IsOptional() @IsString() managingDirector?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankIban?: string;
  @IsOptional() @IsString() bankBic?: string;
}

const COMPANY_SETTINGS_KEY = 'company_info';
const COMPANY_LOGO_KEY = 'company-logo';

@ApiTags('company')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SUPERADMIN', 'OFFICE')
@Controller('company')
export class CompanyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Firmeninformationen abrufen' })
  async get(): Promise<Record<string, string>> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_SETTINGS_KEY },
    });
    if (!setting) return {};
    try {
      return JSON.parse(setting.value);
    } catch {
      return {};
    }
  }

  @Post()
  @ApiOperation({ summary: 'Firmeninformationen speichern' })
  async save(@Body() dto: CompanyInfoDto): Promise<{ success: true }> {
    await this.prisma.appSetting.upsert({
      where: { key: COMPANY_SETTINGS_KEY },
      update: { value: JSON.stringify(dto) },
      create: { key: COMPANY_SETTINGS_KEY, value: JSON.stringify(dto) },
    });
    return { success: true };
  }

  @Post('logo')
  @ApiOperation({ summary: 'Firmenlogo hochladen' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ success: true; logoKey: string }> {
    if (!file) {
      throw new BadRequestException('Keine Datei');
    }
    const ext = file.originalname.split('.').pop() ?? 'png';
    const logoKey = `${COMPANY_LOGO_KEY}.${ext}`;
    await this.storage.upload(logoKey, file.buffer, file.mimetype);
    await this.prisma.appSetting.upsert({
      where: { key: 'company_logo_key' },
      update: { value: logoKey },
      create: { key: 'company_logo_key', value: logoKey },
    });
    return { success: true, logoKey };
  }

  @Get('logo')
  @ApiOperation({ summary: 'Firmenlogo-Key abrufen' })
  async getLogoKey(): Promise<{ logoKey: string | null }> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'company_logo_key' },
    });
    return { logoKey: setting?.value ?? null };
  }
}
