/**
 * HTTP-API für Produktkatalog und Kundenpreise.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InvoiceProductsService } from './invoice-products.service';
import { CreateInvoiceProductDto } from './dto/create-invoice-product.dto';
import { UpdateInvoiceProductDto } from './dto/update-invoice-product.dto';
import { UpsertCustomerProductPriceDto } from './dto/upsert-customer-product-price.dto';

@ApiTags('invoice-products')
@ApiBearerAuth()
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('invoices')
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller()
export class InvoiceProductsController {
  constructor(private readonly products: InvoiceProductsService) {}

  @Get('invoice-products')
  @ApiOperation({ summary: 'Produktkatalog auflisten' })
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
  list(
    @Query('activeOnly') activeOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.products.findAll({
      activeOnly: activeOnly === 'true' || activeOnly === '1',
      search,
    });
  }

  @Get('invoice-products/:id')
  @ApiOperation({ summary: 'Produkt laden' })
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
  get(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Post('invoice-products')
  @ApiOperation({ summary: 'Produkt anlegen' })
  create(@Body() dto: CreateInvoiceProductDto) {
    return this.products.create(dto);
  }

  @Patch('invoice-products/:id')
  @ApiOperation({ summary: 'Produkt bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceProductDto) {
    return this.products.update(id, dto);
  }

  @Delete('invoice-products/:id')
  @ApiOperation({ summary: 'Produkt löschen bzw. deaktivieren' })
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Get('customers/:customerId/product-prices')
  @ApiOperation({ summary: 'Kundenpreise auflisten' })
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
  listCustomerPrices(@Param('customerId') customerId: string) {
    return this.products.listCustomerPrices(customerId);
  }

  @Put('customers/:customerId/product-prices')
  @ApiOperation({ summary: 'Kundenpreis setzen' })
  upsertCustomerPrice(
    @Param('customerId') customerId: string,
    @Body() dto: UpsertCustomerProductPriceDto,
  ) {
    return this.products.upsertCustomerPrice(customerId, dto);
  }

  @Delete('customers/:customerId/product-prices/:productId')
  @ApiOperation({ summary: 'Kundenpreis entfernen' })
  removeCustomerPrice(
    @Param('customerId') customerId: string,
    @Param('productId') productId: string,
  ) {
    return this.products.removeCustomerPrice(customerId, productId);
  }

  @Get('invoice-products/:id/resolve-price')
  @ApiOperation({ summary: 'Effektiven Preis (Kunde > Default) auflösen' })
  @Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
  resolvePrice(
    @Param('id') id: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.products.resolveUnitPrice(id, customerId);
  }
}
