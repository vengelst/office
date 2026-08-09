/**
 * HTTP-API für Contacts.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContactsService } from './contacts.service';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get('suggestions')
  @ApiOperation({
    summary:
      'Kontakt-Vorschläge aus Kunden- und Subunternehmen-Ansprechpartnern',
  })
  /**
   * Liefert Autocomplete-/Suchvorschläge.
   *
   * @param q - Parameter `q` (string)
   * @param customerId - ID des Kunden (string)
   * @param limit - Seitengröße (string)
   * @returns Vorschlagsliste
   */
  suggestions(
    @Query('q') q?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contacts.suggestions({
      q,
      customerId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
