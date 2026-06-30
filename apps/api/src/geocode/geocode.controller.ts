import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GeocodeService, type GeocodeResult } from './geocode.service';

/**
 * Geokodierungs-Proxy. Durch den globalen JwtAuthGuard geschützt
 * (kein RolesGuard – jeder eingeloggte Nutzer darf geocoden).
 */
@ApiTags('geocode')
@ApiBearerAuth()
@Controller('geocode')
export class GeocodeController {
  constructor(private readonly geocode: GeocodeService) {}

  @Get()
  @ApiOperation({ summary: 'Adresse zu Koordinaten auflösen (OSM Nominatim)' })
  lookup(@Query('address') address?: string): Promise<GeocodeResult> {
    if (!address || !address.trim()) {
      throw new BadRequestException('address-Parameter erforderlich');
    }
    return this.geocode.lookup(address);
  }
}
