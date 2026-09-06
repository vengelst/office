import { Module } from '@nestjs/common';
import { InvoiceProductsController } from './invoice-products.controller';
import { InvoiceProductsService } from './invoice-products.service';

@Module({
  controllers: [InvoiceProductsController],
  providers: [InvoiceProductsService],
  exports: [InvoiceProductsService],
})
export class InvoiceProductsModule {}
