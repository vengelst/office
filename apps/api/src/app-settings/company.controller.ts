/**
 * Modul: Company Info Dto.
 * Teil der Office-API unter apps/api.
 */

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  BadRequestException,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
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
  /** Standard-/DE-USt-IdNr. */
  @IsOptional() @IsString() vatId?: string;
  /** USt-IdNr. je Land (ISO-Code → Id), z. B. { DE, LU, NL, FR }. */
  @IsOptional() @IsObject() vatIdsByCountry?: Record<string, string>;
  @IsOptional() @IsString() registerCourt?: string;
  @IsOptional() @IsString() registerNumber?: string;
  @IsOptional() @IsString() managingDirector?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankIban?: string;
  @IsOptional() @IsString() bankBic?: string;
  /** Elektronische Adresse (BT-34), z. B. E-Mail für E-Rechnung */
  @IsOptional() @IsString() electronicAddress?: string;
}

const COMPANY_SETTINGS_KEY = 'company_info';
const COMPANY_LOGO_KEY = 'company-logo';
const COMPANY_LOGO_SETTING = 'company_logo_key';
const COMPANY_LOGO_DARK_KEY = 'company-logo-dark';
const COMPANY_LOGO_DARK_SETTING = 'company_logo_dark_key';

const ALLOWED_LOGO_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
];

function logoMimeFromKey(key: string): string {
  return key.endsWith('.png')
    ? 'image/png'
    : key.endsWith('.webp')
      ? 'image/webp'
      : key.endsWith('.svg')
        ? 'image/svg+xml'
        : 'image/jpeg';
}

/** Normalisiert vatIdsByCountry und hält vatId (DE) synchron. */
function normalizeCompanyPayload(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const vatIdsByCountry: Record<string, string> = {};
  const incoming = raw.vatIdsByCountry;
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      const code = String(k).trim().toUpperCase();
      if (!code || typeof v !== 'string') continue;
      const id = v.trim();
      if (id) vatIdsByCountry[code] = id;
    }
  }
  const vatId =
    typeof raw.vatId === 'string' && raw.vatId.trim()
      ? raw.vatId.trim()
      : vatIdsByCountry.DE ?? '';
  if (vatId && !vatIdsByCountry.DE) vatIdsByCountry.DE = vatId;
  return {
    ...raw,
    vatId: vatIdsByCountry.DE ?? vatId,
    vatIdsByCountry,
  };
}

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

  /**
   * Liest einen Konfigurations- oder Datensatzwert.
   *
   * @returns Gelesener Wert (Record<string, string>)
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */

  @Get()
  @ApiOperation({ summary: 'Firmeninformationen abrufen' })
  async get(): Promise<Record<string, unknown>> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_SETTINGS_KEY },
    });
    if (!setting) return {};
    try {
      const parsed = JSON.parse(setting.value) as Record<string, unknown>;
      return normalizeCompanyPayload(parsed);
    } catch {
      return {};
    }
  }

  /**
   * Speichert Konfiguration oder Daten.
   *
   * @param dto - Request-Body / Eingabedaten (CompanyInfoDto)
   * @returns Gespeicherter Wert
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */

  @Post()
  @ApiOperation({ summary: 'Firmeninformationen speichern' })
  async save(@Body() dto: CompanyInfoDto): Promise<{ success: true }> {
    const payload = normalizeCompanyPayload(dto as Record<string, unknown>);
    await this.prisma.appSetting.upsert({
      where: { key: COMPANY_SETTINGS_KEY },
      update: { value: JSON.stringify(payload) },
      create: { key: COMPANY_SETTINGS_KEY, value: JSON.stringify(payload) },
    });
    return { success: true };
  }

  @Post('logo')
  @ApiOperation({ summary: 'Firmenlogo hochladen' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  /**
   * Lädt das Firmenlogo hoch.
   *
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File | undefined)
   * @returns Speicherpfad bzw. Key des Logos
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ success: true; logoKey: string }> {
    if (!file) {
      throw new BadRequestException('Keine Datei');
    }
    if (file.mimetype && !ALLOWED_LOGO_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Nur Bilddateien (PNG, JPEG, WebP, SVG)');
    }
    const ext = (file.originalname.split('.').pop() ?? 'png').toLowerCase();
    const logoKey = `${COMPANY_LOGO_KEY}.${ext}`;
    const prev = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_SETTING },
    });
    if (prev?.value && prev.value !== logoKey) {
      await this.storage.remove(prev.value).catch(() => undefined);
    }
    await this.storage.upload(logoKey, file.buffer, file.mimetype);
    await this.prisma.appSetting.upsert({
      where: { key: COMPANY_LOGO_SETTING },
      update: { value: logoKey },
      create: { key: COMPANY_LOGO_SETTING, value: logoKey },
    });
    return { success: true, logoKey };
  }

  /**
   * Liefert den Storage-Key des Firmenlogos.
   *
   * @returns Key oder null
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */

  @Get('logo')
  @ApiOperation({ summary: 'Firmenlogo-Key abrufen' })
  async getLogoKey(): Promise<{ logoKey: string | null }> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_SETTING },
    });
    return { logoKey: setting?.value ?? null };
  }

  /**
   * Öffentlicher Stream des Firmenlogos (Login, Sidebar, Druck). Keine Rollenpflicht – Logo ist kein Geheimnis.
   *
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */

  @Public()
  @Roles()
  @Get('logo/file')
  @ApiOperation({ summary: 'Firmenlogo als Datei-Stream' })
  async getLogoFile(
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_SETTING },
    });
    if (!setting?.value) {
      throw new NotFoundException('Kein Firmenlogo hinterlegt');
    }
    const key = setting.value;
    const stream = await this.storage.getStream(key);
    res.set({
      'Content-Type': logoMimeFromKey(key),
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(stream);
  }

  @Post('logo-dark')
  @ApiOperation({ summary: 'Helles Firmenlogo für Dark Mode hochladen' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadLogoDark(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ success: true; logoKey: string }> {
    if (!file) {
      throw new BadRequestException('Keine Datei');
    }
    if (file.mimetype && !ALLOWED_LOGO_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Nur Bilddateien (PNG, JPEG, WebP, SVG)');
    }
    const ext = (file.originalname.split('.').pop() ?? 'png').toLowerCase();
    const logoKey = `${COMPANY_LOGO_DARK_KEY}.${ext}`;
    const prev = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_DARK_SETTING },
    });
    if (prev?.value && prev.value !== logoKey) {
      await this.storage.remove(prev.value).catch(() => undefined);
    }
    await this.storage.upload(logoKey, file.buffer, file.mimetype);
    await this.prisma.appSetting.upsert({
      where: { key: COMPANY_LOGO_DARK_SETTING },
      update: { value: logoKey },
      create: { key: COMPANY_LOGO_DARK_SETTING, value: logoKey },
    });
    return { success: true, logoKey };
  }

  @Get('logo-dark')
  @ApiOperation({ summary: 'Dark-Mode-Firmenlogo-Key abrufen' })
  async getLogoDarkKey(): Promise<{ logoKey: string | null }> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_DARK_SETTING },
    });
    return { logoKey: setting?.value ?? null };
  }

  @Public()
  @Roles()
  @Get('logo-dark/file')
  @ApiOperation({ summary: 'Dark-Mode-Firmenlogo als Datei-Stream' })
  async getLogoDarkFile(
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: COMPANY_LOGO_DARK_SETTING },
    });
    if (!setting?.value) {
      throw new NotFoundException('Kein Dark-Mode-Firmenlogo hinterlegt');
    }
    const key = setting.value;
    const stream = await this.storage.getStream(key);
    res.set({
      'Content-Type': logoMimeFromKey(key),
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(stream);
  }
}
